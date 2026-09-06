import React from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CaretLeft, FileText, Trash } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { RiskBadge } from "@/src/components/ui";
import { api } from "@/src/api";

const MODE_LABEL: Record<string, string> = { risk: "RISK", swms: "SWMS", density: "DENSITY", machinery: "MACHINERY" };

export default function Documents() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["assessments"], queryFn: () => api.get("/assessments") });
  const items = data || [];

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/assessments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessments"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });
  const clearAll = useMutation({
    mutationFn: () => api.post("/assessments/clear-all"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessments"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="documents-back">
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={s.headerLabel}>DOCUMENTS</Text>
        {items.length > 0 ? (
          <Pressable onPress={() => clearAll.mutate()} testID="clear-all-documents"><Text style={s.clearAll}>CLEAR</Text></Pressable>
        ) : <View style={{ width: 22 }} />}
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color={colors.onSurface} /></View>
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <FileText size={48} color={colors.muted} weight="bold" />
          <Text style={s.emptyText}>No assessments exported yet.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => router.push(`/assessment/${item.id}` as any)} testID={`doc-${item.id}`}>
              <View style={s.modeTag}><Text style={s.modeTagText}>{MODE_LABEL[item.mode] || item.mode.toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.docTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.docMeta}>{new Date(item.created_at).toLocaleString("en-AU")}</Text>
              </View>
              <RiskBadge level={item.result?.overall_risk_level} />
              <Pressable onPress={() => del.mutate(item.id)} hitSlop={8} testID={`delete-doc-${item.id}`}>
                <Trash size={18} color={colors.error} weight="bold" />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: c.borderStrong, backgroundColor: c.surface, gap: 12 },
  back: { width: 22 },
  headerLabel: { flex: 1, fontFamily: fonts.monoBold, fontSize: 13, color: c.onSurface, letterSpacing: 1, textAlign: "center" },
  clearAll: { fontFamily: fonts.monoBold, fontSize: 12, color: c.error, letterSpacing: 1 },
  loading: { paddingVertical: 80, alignItems: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: c.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  modeTag: { backgroundColor: c.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 4 },
  modeTagText: { fontFamily: fonts.monoBold, fontSize: 10, color: c.onSurfaceTertiary, letterSpacing: 0.5 },
  docTitle: { fontFamily: fonts.bodyMed, fontSize: 14, color: c.onSurface },
  docMeta: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 1 },
}));
