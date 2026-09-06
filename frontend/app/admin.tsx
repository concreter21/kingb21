import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Modal } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { CaretLeft, EnvelopeSimple, ShieldCheck, Plus, ArrowCounterClockwise, X } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { Button, Input, StatusBadge } from "@/src/components/ui";
import { api, API } from "@/src/api";

const ROLES = ["Worker", "Contractor", "Supervisor", "Safety Officer", "Admin"];

export default function Admin() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<"gate" | "verify" | "panel">("gate");
  const [adminToken, setAdminToken] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  const [users, setUsers] = useState<any[]>([]);
  const [deleted, setDeleted] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const adminGet = async (path: string) => {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    if (!res.ok) throw new Error((await res.json()).detail || "Failed");
    return res.json();
  };
  const adminSend = async (path: string, method: string, body?: any, token?: string) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || adminToken}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error((await res.json()).detail || "Failed");
    return res.json();
  };

  const requestOtp = async () => {
    setError(""); setBusy(true);
    try {
      const r = await api.post("/admin/request-otp");
      setSentTo(r.sent_to);
      setStep("verify");
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setError(""); setBusy(true);
    try {
      const r = await api.post("/admin/verify-otp", { code });
      setAdminToken(r.admin_token);
      const [u, d] = [await fetchWith(r.admin_token, "/admin/users"), await fetchWith(r.admin_token, "/admin/deleted")];
      setUsers(u); setDeleted(d);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep("panel");
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const fetchWith = async (token: string, path: string) => {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error((await res.json()).detail || "Failed");
    return res.json();
  };

  const refresh = async () => {
    setUsers(await adminGet("/admin/users"));
    setDeleted(await adminGet("/admin/deleted"));
  };

  const cycleRole = async (u: any) => {
    const next = ROLES[(ROLES.indexOf(u.role) + 1) % ROLES.length];
    await adminSend(`/admin/users/${u.id}/role`, "PATCH", { role: next });
    await refresh();
  };

  const restore = async (item: any) => {
    await adminSend("/admin/restore", "POST", { collection: item.collection, id: item.id });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await refresh();
  };

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="admin-back">
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={s.headerLabel}>ADMIN CONSOLE</Text>
        <View style={{ width: 22 }} />
      </View>

      {step === "gate" && (
        <View style={s.center}>
          <ShieldCheck size={48} color={colors.onSurface} weight="fill" />
          <Text style={s.gateTitle}>SECURE ADMIN ACCESS</Text>
          <Text style={s.gateText}>We'll email a one-time 6-digit code to the owner account to verify it's you.</Text>
          {error ? <View style={s.errBox}><Text style={s.errText}>{error}</Text></View> : null}
          <Button title="EMAIL MY ACCESS CODE" onPress={requestOtp} loading={busy} testID="request-otp" style={{ marginTop: 8 }} />
        </View>
      )}

      {step === "verify" && (
        <KeyboardAwareScrollView contentContainerStyle={s.center} bottomOffset={20}>
          <EnvelopeSimple size={48} color={colors.onSurface} weight="fill" />
          <Text style={s.gateTitle}>ENTER CODE</Text>
          <Text style={s.gateText}>Sent to {sentTo}. Valid for 10 minutes.</Text>
          <Input label="6-Digit Code" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="000000" testID="otp-input" />
          {error ? <View style={s.errBox}><Text style={s.errText}>{error}</Text></View> : null}
          <Button title="VERIFY & ENTER" onPress={verifyOtp} loading={busy} disabled={code.length < 6} testID="verify-otp" style={{ marginTop: 8, alignSelf: "stretch" }} />
        </KeyboardAwareScrollView>
      )}

      {step === "panel" && (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>USERS ({users.length})</Text>
            <Pressable style={s.addBtn} onPress={() => setShowAdd(true)} testID="admin-add-user">
              <Plus size={18} color={colors.onBrandPrimary} weight="bold" />
            </Pressable>
          </View>
          {users.map((u) => (
            <View key={u.id} style={s.uRow} testID={`user-${u.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={s.uName}>{u.name}</Text>
                <Text style={s.uEmail}>{u.email}</Text>
              </View>
              <Pressable onPress={() => cycleRole(u)} testID={`role-cycle-${u.id}`}>
                <StatusBadge label={u.role} bg={colors.surfaceInverse} fg={colors.onSurfaceInverse} />
              </Pressable>
            </View>
          ))}

          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>DELETED ITEMS ({deleted.length})</Text>
          </View>
          {deleted.length === 0 ? (
            <View style={s.empty}><Text style={s.emptyText}>Nothing deleted. Cleared items appear here for restore.</Text></View>
          ) : deleted.map((d) => (
            <View key={`${d.collection}-${d.id}`} style={s.uRow} testID={`deleted-${d.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={s.uName} numberOfLines={1}>{d.label}</Text>
                <Text style={s.uEmail}>{d.collection.toUpperCase()} · {new Date(d.deleted_at).toLocaleDateString("en-AU")}{d.photo_path ? " · photo" : ""}</Text>
              </View>
              <Pressable style={s.restoreBtn} onPress={() => restore(d)} testID={`restore-${d.id}`}>
                <ArrowCounterClockwise size={16} color={colors.onSurface} weight="bold" />
                <Text style={s.restoreText}>RESTORE</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <AddUserModal visible={showAdd} onClose={() => setShowAdd(false)} adminSend={adminSend} adminToken={adminToken} onDone={refresh} />
    </View>
  );
}

function AddUserModal({ visible, onClose, adminSend, adminToken, onDone }: any) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Worker");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError(""); setBusy(true);
    try {
      await adminSend("/admin/users", "POST", { name, email, password, role }, adminToken);
      setName(""); setEmail(""); setPassword(""); setRole("Worker");
      onClose(); await onDone();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={[s.modalCard, { paddingBottom: insets.bottom + 20 }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>ADD USER</Text>
            <Pressable onPress={onClose} testID="close-add-user"><X size={24} color={colors.onSurface} weight="bold" /></Pressable>
          </View>
          <KeyboardAwareScrollView contentContainerStyle={{ gap: 14, padding: 20 }} bottomOffset={20}>
            <Input label="Name" value={name} onChangeText={setName} placeholder="Jordan Smith" testID="new-user-name" />
            <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="jordan@thekitchenary.com.au" testID="new-user-email" />
            <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="min 6 characters" testID="new-user-password" />
            <View style={{ gap: 8 }}>
              <Text style={s.roleLabel}>ROLE</Text>
              <View style={s.roleWrap}>
                {ROLES.map((r) => (
                  <Pressable key={r} onPress={() => setRole(r)} style={[s.roleChip, role === r && s.roleChipActive]} testID={`new-role-${r}`}>
                    <Text style={[s.roleChipText, role === r && s.roleChipTextActive]}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {error ? <View style={s.errBox}><Text style={s.errText}>{error}</Text></View> : null}
            <Button title="CREATE USER" onPress={submit} loading={busy} disabled={!email || !password} testID="submit-new-user" />
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: c.borderStrong, backgroundColor: c.surface, gap: 12 },
  back: { width: 22 },
  headerLabel: { flex: 1, fontFamily: fonts.monoBold, fontSize: 13, color: c.onSurface, letterSpacing: 1, textAlign: "center" },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  gateTitle: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface, letterSpacing: 0.5 },
  gateText: { fontFamily: fonts.body, fontSize: 14, color: c.muted, textAlign: "center", lineHeight: 20 },
  errBox: { backgroundColor: c.error, padding: 10, alignSelf: "stretch" },
  errText: { fontFamily: fonts.bodyMed, fontSize: 13, color: c.onError },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
  sectionLabel: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2, color: c.muted },
  addBtn: { width: 32, height: 32, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  uRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 2, borderTopColor: c.borderStrong },
  uName: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurface },
  uEmail: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 1 },
  restoreBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 2, borderColor: c.borderStrong, paddingHorizontal: 10, paddingVertical: 6 },
  restoreText: { fontFamily: fonts.monoBold, fontSize: 11, color: c.onSurface, letterSpacing: 0.5 },
  empty: { paddingHorizontal: 20, paddingVertical: 12 },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: c.surface, borderTopWidth: 3, borderColor: c.borderStrong, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  modalTitle: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface, letterSpacing: 0.5 },
  roleLabel: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, letterSpacing: 1 },
  roleWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: { borderWidth: 2, borderColor: c.borderStrong, paddingHorizontal: 12, paddingVertical: 8 },
  roleChipActive: { backgroundColor: c.brandPrimary },
  roleChipText: { fontFamily: fonts.bodyMed, fontSize: 13, color: c.onSurface },
  roleChipTextActive: { color: c.onBrandPrimary },
}));
