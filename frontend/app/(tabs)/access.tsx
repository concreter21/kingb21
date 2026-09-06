import React, { useState } from "react";
import { View, Text, FlatList, Pressable, Modal, ActivityIndicator, Linking } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import { SignIn, SignOut, UserPlus, X, IdentificationBadge, QrCode, Trash } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { Button, Input, StatusBadge } from "@/src/components/ui";
import { api } from "@/src/api";

const TYPE_LABEL: Record<string, string> = { signin: "SIGN IN", signout: "SIGN OUT", visitor: "VISITOR" };
const SITE_CODE = "TK-GATE-ARNDELL-PARK";

export default function Access() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showVisitor, setShowVisitor] = useState(false);
  const [showScan, setShowScan] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["access"], queryFn: () => api.get("/access") });

  const act = useMutation({
    mutationFn: (type: string) => api.post("/access", { type }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["access"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/access/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["access"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const onSite = data?.status === "in";
  const records = data?.records || [];

  const onScanned = (type: string) => {
    setShowScan(false);
    act.mutate(type);
  };

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>SITE ACCESS</Text>
        <Text style={s.subtitle}>Arndell Park · digital sign-in</Text>
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color={colors.onSurface} /></View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(i) => i.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <View>
              {/* Status panel */}
              <View style={[s.statusPanel, onSite ? s.statusIn : s.statusOut]}>
                <IdentificationBadge size={40} color={onSite ? colors.onSuccess : colors.onSurfaceInverse} weight="fill" />
                <Text style={[s.statusText, { color: onSite ? colors.onSuccess : colors.onSurfaceInverse }]}>
                  {onSite ? "YOU ARE ON SITE" : "YOU ARE OFF SITE"}
                </Text>
                <Text style={[s.statusCount, { color: onSite ? colors.onSuccess : colors.onSurfaceInverse }]}>
                  {data?.on_site ?? 0} PERSONNEL ON SITE
                </Text>
              </View>

              {/* Scan to sign in/out */}
              <Pressable style={s.scanBtn} onPress={() => setShowScan(true)} testID="scan-gate">
                <QrCode size={24} color={colors.onBrandPrimary} weight="bold" />
                <Text style={s.scanText}>{onSite ? "SCAN GATE TO SIGN OUT" : "SCAN GATE TO SIGN IN"}</Text>
              </Pressable>

              {/* Manual Actions */}
              <View style={s.actionsWrap}>
                <Pressable
                  style={[s.actionBtn, onSite && s.actionDisabled]}
                  onPress={() => !onSite && act.mutate("signin")}
                  disabled={onSite || act.isPending}
                  testID="sign-in"
                >
                  <SignIn size={22} color={colors.onSurface} weight="bold" />
                  <Text style={s.actionText}>SIGN IN</Text>
                </Pressable>
                <Pressable
                  style={[s.actionBtn, !onSite && s.actionDisabled]}
                  onPress={() => onSite && act.mutate("signout")}
                  disabled={!onSite || act.isPending}
                  testID="sign-out"
                >
                  <SignOut size={22} color={colors.onSurface} weight="bold" />
                  <Text style={s.actionText}>SIGN OUT</Text>
                </Pressable>
              </View>
              <Pressable style={s.visitorBtn} onPress={() => setShowVisitor(true)} testID="visitor-induction">
                <UserPlus size={20} color={colors.onBrandPrimary} weight="bold" />
                <Text style={s.visitorText}>VISITOR / CONTRACTOR INDUCTION</Text>
              </Pressable>

              {/* Gate QR poster */}
              <View style={s.gatePanel}>
                <Text style={s.gateLabel}>GATE ACCESS CODE</Text>
                <View style={s.qrWrap}>
                  <QRCode value={SITE_CODE} size={140} color={colors.onSurface} backgroundColor={colors.surface} />
                </View>
                <Text style={s.gateName}>ARNDELL PARK · MAIN GATE</Text>
                <Text style={s.gateHint}>Print &amp; post this at the gate. Staff scan it to sign in / out.</Text>
              </View>

              <View style={s.recordsHeader}>
                <Text style={s.recordsLabel}>ACCESS LOG</Text>
              </View>
            </View>
          }
          ListEmptyComponent={<View style={s.emptyBox}><Text style={s.emptyText}>No access records yet.</Text></View>}
          renderItem={({ item }) => (
            <View style={s.recordRow} testID={`access-${item.id}`}>
              <StatusBadge
                label={TYPE_LABEL[item.type] || item.type}
                bg={item.type === "signin" ? colors.success : item.type === "signout" ? colors.surfaceInverse : colors.warning}
                fg={item.type === "signin" ? colors.onSuccess : item.type === "signout" ? colors.onSurfaceInverse : colors.onWarning}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.recordName}>{item.type === "visitor" ? item.visitor_name : item.user_name}</Text>
                <Text style={s.recordMeta}>
                  {item.type === "visitor" && item.company ? `${item.company} · ` : ""}
                  {new Date(item.created_at).toLocaleString("en-AU")}
                </Text>
              </View>
              <Pressable onPress={() => del.mutate(item.id)} hitSlop={8} testID={`delete-access-${item.id}`}>
                <Trash size={18} color={colors.error} weight="bold" />
              </Pressable>
            </View>
          )}
        />
      )}

      <VisitorForm visible={showVisitor} onClose={() => setShowVisitor(false)} />
      <QRScanner visible={showScan} onClose={() => setShowScan(false)} onSite={onSite} onScanned={onScanned} />
    </View>
  );
}

function QRScanner({ visible, onClose, onSite, onScanned }: { visible: boolean; onClose: () => void; onSite: boolean; onScanned: (type: string) => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (visible) {
      setHandled(false);
      setError("");
    }
  }, [visible]);

  const handleScan = (data: string) => {
    if (handled) return;
    if (data !== SITE_CODE) {
      setError("Unrecognised code — scan the TK gate QR.");
      return;
    }
    setHandled(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onScanned(onSite ? "signout" : "signin");
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.scanContainer, { paddingTop: insets.top }]}>
        <View style={s.scanHeader}>
          <Text style={s.scanTitle}>SCAN GATE QR</Text>
          <Pressable onPress={onClose} testID="close-scan"><X size={26} color={colors.onSurfaceInverse} weight="bold" /></Pressable>
        </View>

        {!permission ? (
          <View style={s.scanCenter}><ActivityIndicator color={colors.onSurfaceInverse} /></View>
        ) : !permission.granted ? (
          <View style={s.scanCenter}>
            <QrCode size={48} color={colors.onSurfaceInverse} weight="bold" />
            <Text style={s.scanPermText}>Camera access is needed to scan the gate QR code.</Text>
            {permission.canAskAgain ? (
              <Pressable style={s.scanPermBtn} onPress={requestPermission} testID="scan-enable-camera">
                <Text style={s.scanPermBtnText}>ENABLE CAMERA</Text>
              </Pressable>
            ) : (
              <Pressable style={s.scanPermBtn} onPress={() => Linking.openSettings()} testID="scan-open-settings">
                <Text style={s.scanPermBtnText}>OPEN SETTINGS</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => handleScan(data)}
            />
            <View style={s.scanOverlay} pointerEvents="none">
              <View style={s.scanFrame} />
              <Text style={s.scanHint}>{onSite ? "Point at the gate QR to SIGN OUT" : "Point at the gate QR to SIGN IN"}</Text>
              {error ? <Text style={s.scanError}>{error}</Text> : null}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function VisitorForm({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [visitor_name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [purpose, setPurpose] = useState("");

  const create = useMutation({
    mutationFn: () => api.post("/access", { type: "visitor", visitor_name, company, purpose }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["access"] });
      setName(""); setCompany(""); setPurpose("");
      onClose();
    },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={[s.modalCard, { paddingBottom: insets.bottom + 20 }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>VISITOR INDUCTION</Text>
            <Pressable onPress={onClose} testID="close-visitor"><X size={24} color={colors.onSurface} weight="bold" /></Pressable>
          </View>
          <KeyboardAwareScrollView contentContainerStyle={{ gap: 14, padding: 20 }} bottomOffset={20} showsVerticalScrollIndicator={false}>
            <View style={s.inductNote}>
              <Text style={s.inductText}>All visitors must complete site safety induction: wear PPE, follow traffic routes, report to host.</Text>
            </View>
            <Input label="Visitor Name" value={visitor_name} onChangeText={setName} placeholder="Alex Taylor" testID="visitor-name" />
            <Input label="Company" value={company} onChangeText={setCompany} placeholder="ACME Contractors" testID="visitor-company" />
            <Input label="Purpose of Visit" value={purpose} onChangeText={setPurpose} placeholder="Refrigeration service" testID="visitor-purpose" multiline />
            <Button title="COMPLETE INDUCTION" onPress={() => visitor_name && create.mutate()} loading={create.isPending} disabled={!visitor_name} testID="submit-visitor" />
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: c.borderStrong, backgroundColor: c.surface },
  title: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface },
  subtitle: { fontFamily: fonts.mono, fontSize: 12, color: c.muted, marginTop: 2 },
  loading: { paddingVertical: 80, alignItems: "center" },
  statusPanel: { alignItems: "center", padding: 28, gap: 8, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  statusIn: { backgroundColor: c.success },
  statusOut: { backgroundColor: c.surfaceInverse },
  statusText: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.5 },
  statusCount: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1, opacity: 0.85 },
  actionsWrap: { flexDirection: "row" },
  scanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: c.brandPrimary, paddingVertical: 18, borderBottomWidth: 2, borderColor: c.borderStrong },
  scanText: { fontFamily: fonts.monoBold, fontSize: 14, color: c.onBrandPrimary, letterSpacing: 1 },
  gatePanel: { alignItems: "center", padding: 24, gap: 8, borderBottomWidth: 2, borderColor: c.borderStrong },
  gateLabel: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, letterSpacing: 2 },
  qrWrap: { padding: 16, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: c.surface },
  gateName: { fontFamily: fonts.monoBold, fontSize: 13, color: c.onSurface, letterSpacing: 1 },
  gateHint: { fontFamily: fonts.body, fontSize: 12, color: c.muted, textAlign: "center" },
  actionBtn: { flex: 1, paddingVertical: 22, alignItems: "center", justifyContent: "center", gap: 8, borderBottomWidth: 2, borderRightWidth: 2, borderColor: c.borderStrong },
  actionDisabled: { opacity: 0.3 },
  actionText: { fontFamily: fonts.monoBold, fontSize: 13, color: c.onSurface, letterSpacing: 1 },
  visitorBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: c.brandPrimary, paddingVertical: 18, borderBottomWidth: 2, borderColor: c.borderStrong },
  visitorText: { fontFamily: fonts.monoBold, fontSize: 13, color: c.onBrandPrimary, letterSpacing: 1 },
  recordsHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
  recordsLabel: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2, color: c.muted },
  emptyBox: { padding: 20 },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
  recordRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 2, borderTopColor: c.borderStrong },
  recordName: { fontFamily: fonts.bodyMed, fontSize: 14, color: c.onSurface },
  recordMeta: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 1 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: c.surface, borderTopWidth: 3, borderColor: c.borderStrong, maxHeight: "88%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  modalTitle: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface, letterSpacing: 0.5 },
  inductNote: { backgroundColor: c.warning, padding: 12 },
  inductText: { fontFamily: fonts.bodyMed, fontSize: 13, color: c.onWarning },

  scanContainer: { flex: 1, backgroundColor: c.surfaceInverse },
  scanHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20 },
  scanTitle: { fontFamily: fonts.display, fontSize: 20, color: c.onSurfaceInverse, letterSpacing: 0.5 },
  scanCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  scanPermText: { fontFamily: fonts.body, fontSize: 14, color: c.onSurfaceInverse, textAlign: "center", opacity: 0.85, lineHeight: 20 },
  scanPermBtn: { backgroundColor: c.surface, paddingHorizontal: 24, paddingVertical: 14 },
  scanPermBtnText: { fontFamily: fonts.monoBold, fontSize: 13, color: c.onSurface, letterSpacing: 1 },
  scanOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 20 },
  scanFrame: { width: 220, height: 220, borderWidth: 3, borderColor: "#FFFFFF" },
  scanHint: { fontFamily: fonts.monoBold, fontSize: 13, color: "#FFFFFF", letterSpacing: 1, textAlign: "center", paddingHorizontal: 24 },
  scanError: { fontFamily: fonts.bodyMed, fontSize: 13, color: "#FFFFFF", backgroundColor: c.error, paddingHorizontal: 12, paddingVertical: 6 },
}));
