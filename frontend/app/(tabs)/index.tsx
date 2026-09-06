import React, { useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  ScanSmiley,
  Lock,
  IdentificationBadge,
  Warning,
  TrafficSign,
  FileText,
  Gear,
  Headset,
  CaretRight,
} from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { SectionLabel } from "@/src/components/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

const MODE_LABEL: Record<string, string> = {
  risk: "RISK",
  swms: "SWMS",
  density: "DENSITY",
  machinery: "MACHINERY",
};

export default function Home() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard"),
  });

  const go = useCallback((path: string) => () => router.push(path as any), [router]);

  const metrics = [
    { label: "OPEN INCIDENTS", value: data?.open_incidents ?? 0, danger: (data?.open_incidents ?? 0) > 0 },
    { label: "ACTIVE LOCKS", value: data?.active_locks ?? 0, danger: false },
    { label: "ON SITE", value: data?.on_site ?? 0, danger: false },
    { label: "ASSESSMENTS", value: data?.assessments_count ?? 0, danger: false },
  ];

  const modules = [
    { key: "assess", title: "AI Assess", desc: "Live risk, SWMS, density, machinery", icon: ScanSmiley, path: "/(tabs)/assess" },
    { key: "equipment", title: "Equipment Register", desc: "AI-assessed plant & devices", icon: Gear, path: "/equipment" },
    { key: "loto", title: "LOTO Register", desc: "Lockout / tagout controls", icon: Lock, path: "/(tabs)/registers" },
    { key: "access", title: "Site Access", desc: "Sign in / out, inductions", icon: IdentificationBadge, path: "/(tabs)/access" },
    { key: "traffic", title: "Traffic Mgmt", desc: "Pedestrian & forklift zones", icon: TrafficSign, path: "/traffic" },
    { key: "incidents", title: "Incidents", desc: "Report & track hazards", icon: Warning, path: "/incidents" },
    { key: "docs", title: "Documents", desc: "Assessment history & PDFs", icon: FileText, path: "/documents" },
  ];

  return (
    <View style={s.container}>
      {/* Sticky header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={s.brand}>TK SAFETYGUARD</Text>
          <Text style={s.hello}>Hi, {user?.name?.split(" ")[0] || "there"}</Text>
        </View>
        <View style={s.roleBadge}>
          <Text style={s.roleText}>{(user?.role || "WORKER").toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.onSurface} />}
      >
        {isLoading ? (
          <View style={s.loading}>
            <ActivityIndicator color={colors.onSurface} />
          </View>
        ) : (
          <>
            {/* Metrics grid */}
            <View style={s.metricGrid}>
              {metrics.map((m, i) => (
                <View key={m.label} style={[s.metricCard, m.danger && s.metricDanger]} testID={`metric-${i}`}>
                  <Text style={[s.metricValue, m.danger && s.metricValueDanger]}>{m.value}</Text>
                  <Text style={[s.metricLabel, m.danger && s.metricLabelDanger]}>{m.label}</Text>
                </View>
              ))}
            </View>

            {/* Modules */}
            <View style={s.section}>
              <SectionLabel>Safety Modules</SectionLabel>
            </View>
            <View style={s.moduleList}>
              {modules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Pressable key={mod.key} style={s.moduleRow} onPress={go(mod.path)} testID={`module-${mod.key}`}>
                    <View style={s.moduleIcon}>
                      <Icon size={24} color={colors.onBrandPrimary} weight="bold" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.moduleTitle}>{mod.title}</Text>
                      <Text style={s.moduleDesc}>{mod.desc}</Text>
                    </View>
                    <CaretRight size={20} color={colors.muted} weight="bold" />
                  </Pressable>
                );
              })}
            </View>

            {/* Recent activity */}
            <View style={s.section}>
              <SectionLabel>Recent Assessments</SectionLabel>
            </View>
            {(data?.recent_assessments || []).length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>No assessments yet. Run an AI Assess to get started.</Text>
              </View>
            ) : (
              <View style={s.recentList}>
                {data.recent_assessments.map((a: any) => (
                  <Pressable
                    key={a.id}
                    style={s.recentRow}
                    onPress={() => router.push(`/assessment/${a.id}` as any)}
                    testID={`recent-${a.id}`}
                  >
                    <View style={s.modeTag}>
                      <Text style={s.modeTagText}>{MODE_LABEL[a.mode] || a.mode.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.recentTitle} numberOfLines={1}>{a.title}</Text>
                      <Text style={s.recentMeta}>{a.result?.overall_risk_level || "—"} · {new Date(a.created_at).toLocaleDateString("en-AU")}</Text>
                    </View>
                    <CaretRight size={18} color={colors.muted} weight="bold" />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Pressable style={s.fab} onPress={() => router.push("/support" as any)} testID="support-fab">
        <Headset size={26} color={colors.onBrandPrimary} weight="fill" />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: c.borderStrong,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    backgroundColor: c.surface,
  },
  brand: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: c.muted },
  hello: { fontFamily: fonts.display, fontSize: 26, color: c.onSurface, marginTop: 2 },
  roleBadge: { backgroundColor: c.brandPrimary, paddingHorizontal: 10, paddingVertical: 5 },
  roleText: { fontFamily: fonts.monoBold, fontSize: 10, color: c.onBrandPrimary, letterSpacing: 1 },
  loading: { paddingVertical: 80, alignItems: "center" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap" },
  metricCard: {
    width: "50%",
    padding: 20,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
  },
  metricDanger: { backgroundColor: c.error },
  metricValue: { fontFamily: fonts.monoBold, fontSize: 40, color: c.onSurface },
  metricValueDanger: { color: c.onError },
  metricLabel: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, letterSpacing: 1, marginTop: 2 },
  metricLabelDanger: { color: c.onError },
  section: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  moduleList: { borderTopWidth: 2, borderTopColor: c.borderStrong },
  moduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: c.borderStrong,
  },
  moduleIcon: { width: 44, height: 44, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  moduleTitle: { fontFamily: fonts.bodySemi, fontSize: 16, color: c.onSurface },
  moduleDesc: { fontFamily: fonts.body, fontSize: 12, color: c.muted, marginTop: 1 },
  emptyBox: { marginHorizontal: 20, padding: 20, borderWidth: 2, borderColor: c.border },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
  recentList: { borderTopWidth: 2, borderTopColor: c.borderStrong },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: c.borderStrong,
  },
  modeTag: { backgroundColor: c.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 4 },
  modeTagText: { fontFamily: fonts.monoBold, fontSize: 10, color: c.onSurfaceTertiary, letterSpacing: 0.5 },
  recentTitle: { fontFamily: fonts.bodyMed, fontSize: 14, color: c.onSurface },
  recentMeta: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 1 },
  fab: { position: "absolute", right: 20, bottom: 20, width: 56, height: 56, backgroundColor: c.brandPrimary, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
}));
