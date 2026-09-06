import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Warning, TrafficSign, SignOut, User, Gear, CaretRight } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { SectionLabel } from "@/src/components/ui";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";

export default function Profile() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get("/dashboard") });

  const links = [
    { key: "equipment", title: "Equipment Register", desc: `${dash?.equipment_count ?? 0} assessed`, icon: Gear, path: "/equipment" },
    { key: "documents", title: "Documents & PDFs", desc: `${dash?.assessments_count ?? 0} assessments`, icon: FileText, path: "/documents" },
    { key: "incidents", title: "Incident Reports", desc: `${dash?.open_incidents ?? 0} open`, icon: Warning, path: "/incidents" },
    { key: "traffic", title: "Traffic Zones", desc: `${dash?.traffic_zones ?? 0} zones`, icon: TrafficSign, path: "/traffic" },
  ];

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>PROFILE</Text>
        <Pressable onPress={() => router.push("/settings" as any)} style={s.gear} testID="open-settings">
          <Gear size={24} color={colors.onSurface} weight="bold" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <View style={s.userCard}>
          <View style={s.avatar}>
            <User size={32} color={colors.onBrandPrimary} weight="bold" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.name}</Text>
            <Text style={s.email}>{user?.email}</Text>
            <View style={s.roleBadge}><Text style={s.roleText}>{(user?.role || "WORKER").toUpperCase()}</Text></View>
          </View>
        </View>

        <View style={s.section}><SectionLabel>Records</SectionLabel></View>
        <View style={s.list}>
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Pressable key={l.key} style={s.row} onPress={() => router.push(l.path as any)} testID={`profile-${l.key}`}>
                <View style={s.rowIcon}><Icon size={22} color={colors.onSurface} weight="bold" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{l.title}</Text>
                  <Text style={s.rowDesc}>{l.desc}</Text>
                </View>
                <CaretRight size={18} color={colors.muted} weight="bold" />
              </Pressable>
            );
          })}
        </View>

        <View style={s.section}><SectionLabel>Compliance</SectionLabel></View>
        <View style={s.complianceCard}>
          <Text style={s.complianceText}>
            TK SafetyGuard is aligned with the Work Health and Safety Act 2011 (Cth) and relevant Codes of Practice.
            AI-generated assessments must be reviewed and signed off by a competent person.
          </Text>
        </View>

        <Pressable style={s.logout} onPress={logout} testID="logout-button">
          <SignOut size={20} color={colors.onError} weight="bold" />
          <Text style={s.logoutText}>LOG OUT</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: c.borderStrong, backgroundColor: c.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gear: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface },
  userCard: { flexDirection: "row", alignItems: "center", gap: 16, padding: 20, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  avatar: { width: 64, height: 64, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.borderStrong },
  name: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface },
  email: { fontFamily: fonts.body, fontSize: 13, color: c.muted, marginTop: 1 },
  roleBadge: { alignSelf: "flex-start", backgroundColor: c.surfaceInverse, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  roleText: { fontFamily: fonts.monoBold, fontSize: 10, color: c.onSurfaceInverse, letterSpacing: 1 },
  section: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  list: { borderTopWidth: 2, borderTopColor: c.borderStrong },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  rowIcon: { width: 40, height: 40, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurface },
  rowDesc: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 1 },
  complianceCard: { marginHorizontal: 20, padding: 16, borderWidth: 2, borderColor: c.border },
  complianceText: { fontFamily: fonts.body, fontSize: 12, color: c.onSurfaceSecondary, lineHeight: 19 },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 20, marginTop: 28, paddingVertical: 16, backgroundColor: c.error },
  logoutText: { fontFamily: fonts.monoBold, fontSize: 14, color: c.onError, letterSpacing: 1 },
}));
