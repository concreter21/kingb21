import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, Modal, useColorScheme } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import { CaretLeft, Sparkle, Moon, DeviceMobile, LockKey, CaretRight, Key, Trash, X } from "phosphor-react-native";

import { makeStyles, fonts, useTheme, setColorScheme } from "@/src/theme";
import { SectionLabel, Button, Input } from "@/src/components/ui";
import { storage } from "@/src/utils/storage";
import { useAuth } from "@/src/auth";

const DOWNLOAD_URL = process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL || "";
const OWNER_EMAIL = "halfbc175@gmail.com";

export default function Settings() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, changePassword, deleteAccount } = useAuth();
  const system = useColorScheme();

  const [aiAssist, setAiAssist] = useState(true);
  const [dark, setDark] = useState(system === "dark");
  const [showPw, setShowPw] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    storage.getItem<boolean>("tk_ai_assist", true).then((v) => setAiAssist(v ?? true));
    storage.getItem<string>("tk_theme", "system").then((v) => {
      if (v === "dark") setDark(true);
      else if (v === "light") setDark(false);
    });
  }, []);

  const toggleAi = async (v: boolean) => {
    setAiAssist(v);
    await storage.setItem("tk_ai_assist", v);
  };
  const toggleDark = async (v: boolean) => {
    setDark(v);
    await storage.setItem("tk_theme", v ? "dark" : "light");
    setColorScheme(v ? "dark" : "light");
  };

  const isOwner = (user?.email || "").toLowerCase() === OWNER_EMAIL;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="settings-back">
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={s.headerLabel}>SETTINGS</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <View style={s.section}><SectionLabel>Preferences</SectionLabel></View>

        <View style={s.row}>
          <View style={s.rowIcon}><Sparkle size={22} color={colors.onSurface} weight="bold" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>AI Assist</Text>
            <Text style={s.rowDesc}>Enable AI-powered camera assessments</Text>
          </View>
          <Switch value={aiAssist} onValueChange={toggleAi} testID="toggle-ai-assist"
            trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.surface} />
        </View>

        <View style={s.row}>
          <View style={s.rowIcon}><Moon size={22} color={colors.onSurface} weight="bold" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>Dark Mode</Text>
            <Text style={s.rowDesc}>Switch between light and dark theme</Text>
          </View>
          <Switch value={dark} onValueChange={toggleDark} testID="toggle-dark-mode"
            trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.surface} />
        </View>

        <View style={s.section}><SectionLabel>Get the App</SectionLabel></View>
        <View style={s.qrPanel}>
          <View style={s.rowIcon}><DeviceMobile size={22} color={colors.onSurface} weight="bold" /></View>
          {DOWNLOAD_URL ? (
            <>
              <View style={s.qrBox}>
                <QRCode value={DOWNLOAD_URL} size={130} color={colors.onSurface} backgroundColor={colors.surface} />
              </View>
              <Text style={s.qrHint}>Scan to download TK SafetyGuard</Text>
            </>
          ) : (
            <>
              <View style={s.qrPlaceholder}>
                <DeviceMobile size={40} color={colors.muted} weight="bold" />
              </View>
              <Text style={s.qrHint}>Your download QR appears here once the app is published to the App Store / Play Store.</Text>
            </>
          )}
        </View>

        {isOwner ? (
          <>
            <View style={s.section}><SectionLabel>Administration</SectionLabel></View>
            <Pressable style={s.adminRow} onPress={() => router.push("/admin" as any)} testID="open-admin">
              <View style={s.adminIcon}><LockKey size={22} color={colors.onError} weight="bold" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.adminTitle}>Admin Console</Text>
                <Text style={s.adminDesc}>2FA required · users, roles, deleted items</Text>
              </View>
              <CaretRight size={20} color={colors.muted} weight="bold" />
            </Pressable>
          </>
        ) : null}

        <View style={s.section}><SectionLabel>Account</SectionLabel></View>
        <Pressable style={s.row} onPress={() => setShowPw(true)} testID="open-change-password">
          <View style={s.rowIcon}><Key size={22} color={colors.onSurface} weight="bold" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>Change Password</Text>
            <Text style={s.rowDesc}>Set a new private password</Text>
          </View>
          <CaretRight size={20} color={colors.muted} weight="bold" />
        </Pressable>
        <Pressable style={s.row} onPress={() => setShowDelete(true)} testID="open-delete-account">
          <View style={[s.rowIcon, { backgroundColor: colors.error }]}><Trash size={22} color={colors.onError} weight="bold" /></View>
          <View style={{ flex: 1 }}>
            <Text style={[s.rowTitle, { color: colors.error }]}>Delete Account</Text>
            <Text style={s.rowDesc}>Permanently remove your account</Text>
          </View>
          <CaretRight size={20} color={colors.muted} weight="bold" />
        </Pressable>
      </ScrollView>

      <ChangePasswordModal visible={showPw} onClose={() => setShowPw(false)} changePassword={changePassword} />
      <DeleteAccountModal
        visible={showDelete}
        onClose={() => setShowDelete(false)}
        deleteAccount={deleteAccount}
        onDeleted={() => { setShowDelete(false); router.replace("/(auth)/login"); }}
      />
    </View>
  );
}

function ChangePasswordModal({ visible, onClose, changePassword }: any) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(""); setOk("");
    if (next.length < 6) { setError("New password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setOk("Password updated"); setCurrent(""); setNext("");
      setTimeout(onClose, 900);
    } catch (e: any) { setError(e.message || "Failed"); } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={[s.modalCard, { paddingBottom: insets.bottom + 20 }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>CHANGE PASSWORD</Text>
            <Pressable onPress={onClose} testID="close-change-password"><X size={24} color={colors.onSurface} weight="bold" /></Pressable>
          </View>
          <KeyboardAwareScrollView contentContainerStyle={{ gap: 14, padding: 20 }} bottomOffset={20}>
            <Input label="Current Password" value={current} onChangeText={setCurrent} secureTextEntry placeholder="••••••••" testID="current-password-input" />
            <Input label="New Password" value={next} onChangeText={setNext} secureTextEntry placeholder="min 6 characters" testID="new-password-input" />
            {error ? <View style={s.errBox}><Text style={s.errText}>{error}</Text></View> : null}
            {ok ? <View style={s.okBox}><Text style={s.okText}>{ok}</Text></View> : null}
            <Button title="UPDATE PASSWORD" onPress={submit} loading={busy} disabled={!current || !next} testID="submit-change-password" />
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DeleteAccountModal({ visible, onClose, deleteAccount, onDeleted }: any) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (!password) { setError("Enter your password to confirm"); return; }
    setBusy(true);
    try {
      await deleteAccount(password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setPassword("");
      onDeleted();
    } catch (e: any) { setError(e.message || "Failed"); } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={[s.modalCard, { paddingBottom: insets.bottom + 20 }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>DELETE ACCOUNT</Text>
            <Pressable onPress={onClose} testID="close-delete-account"><X size={24} color={colors.onSurface} weight="bold" /></Pressable>
          </View>
          <KeyboardAwareScrollView contentContainerStyle={{ gap: 14, padding: 20 }} bottomOffset={20}>
            <View style={s.warnBox}>
              <Text style={s.warnText}>This permanently removes your account and signs you out. Your safety records are retained for WHS compliance but your login will no longer work.</Text>
            </View>
            <Input label="Confirm Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter your password" testID="delete-password-input" />
            {error ? <View style={s.errBox}><Text style={s.errText}>{error}</Text></View> : null}
            <Button title="DELETE MY ACCOUNT" variant="danger" onPress={submit} loading={busy} disabled={!password} testID="submit-delete-account" />
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
  section: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 2, borderTopColor: c.borderStrong },
  rowIcon: { width: 40, height: 40, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurface },
  rowDesc: { fontFamily: fonts.body, fontSize: 12, color: c.muted, marginTop: 1 },
  qrPanel: { alignItems: "center", gap: 12, paddingVertical: 20, borderTopWidth: 2, borderTopColor: c.borderStrong },
  qrBox: { padding: 16, borderWidth: 2, borderColor: c.borderStrong },
  qrPlaceholder: { width: 162, height: 162, borderWidth: 2, borderStyle: "dashed", borderColor: c.border, alignItems: "center", justifyContent: "center" },
  qrHint: { fontFamily: fonts.body, fontSize: 12, color: c.muted, textAlign: "center", paddingHorizontal: 24 },
  adminRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 2, borderBottomWidth: 2, borderColor: c.borderStrong },
  adminIcon: { width: 40, height: 40, backgroundColor: c.error, alignItems: "center", justifyContent: "center" },
  adminTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurface },
  adminDesc: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: c.surface, borderTopWidth: 3, borderColor: c.borderStrong, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  modalTitle: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface, letterSpacing: 0.5 },
  errBox: { backgroundColor: c.error, padding: 10 },
  errText: { fontFamily: fonts.bodyMed, fontSize: 13, color: c.onError },
  okBox: { backgroundColor: c.success, padding: 10 },
  okText: { fontFamily: fonts.bodyMed, fontSize: 13, color: c.onSuccess },
  warnBox: { backgroundColor: c.warning, padding: 12 },
  warnText: { fontFamily: fonts.bodyMed, fontSize: 13, color: c.onWarning, lineHeight: 19 },
}));
