import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { CaretLeft, Sparkle, Moon, DeviceMobile, LockKey, CaretRight } from "phosphor-react-native";

import { makeStyles, fonts, useTheme, setColorScheme } from "@/src/theme";
import { SectionLabel } from "@/src/components/ui";
import { storage } from "@/src/utils/storage";
import { useAuth } from "@/src/auth";

const APP_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const OWNER_EMAIL = "halfbc175@gmail.com";

export default function Settings() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const system = useColorScheme();

  const [aiAssist, setAiAssist] = useState(true);
  const [dark, setDark] = useState(system === "dark");

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
          <View style={s.qrBox}>
            <QRCode value={APP_URL} size={130} color={colors.onSurface} backgroundColor={colors.surface} />
          </View>
          <Text style={s.qrHint}>Scan to open TK SafetyGuard on another device</Text>
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
      </ScrollView>
    </View>
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
  qrHint: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  adminRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 2, borderBottomWidth: 2, borderColor: c.borderStrong },
  adminIcon: { width: 40, height: 40, backgroundColor: c.error, alignItems: "center", justifyContent: "center" },
  adminTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurface },
  adminDesc: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 1 },
}));
