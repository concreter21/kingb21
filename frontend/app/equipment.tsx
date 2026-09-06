import React from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CaretLeft, Gear, SealCheck, WarningOctagon, Trash } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { StatusBadge } from "@/src/components/ui";
import { api } from "@/src/api";

export default function Equipment() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading } = useQuery({ queryKey: ["equipment"], queryFn: () => api.get("/equipment") });
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/equipment/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipment"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });
  const items = data || [];
  const passed = items.filter((i: any) => i.outcome === "PASS").length;
  const hazards = items.filter((i: any) => i.outcome === "HAZARD").length;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="equipment-back">
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={s.headerLabel}>EQUIPMENT REGISTER</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color={colors.onSurface} /></View>
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Gear size={48} color={colors.muted} weight="bold" />
          <Text style={s.emptyText}>No equipment assessed yet. Run an AI Machinery assessment to register plant &amp; devices here.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.summaryRow}>
              <View style={[s.summaryCell, { borderRightWidth: 2, borderRightColor: colors.borderStrong }]}>
                <Text style={s.summaryNum}>{passed}</Text>
                <Text style={s.summaryLabel}>PASSED</Text>
              </View>
              <View style={[s.summaryCell, hazards > 0 && s.summaryDanger]}>
                <Text style={[s.summaryNum, hazards > 0 && { color: colors.onError }]}>{hazards}</Text>
                <Text style={[s.summaryLabel, hazards > 0 && { color: colors.onError }]}>HAZARD</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const pass = item.outcome === "PASS";
            return (
              <Pressable style={s.row} onPress={() => router.push(`/assessment/${item.assessment_id}` as any)} testID={`equip-${item.id}`}>
                <View style={[s.icon, pass ? s.iconPass : s.iconHazard]}>
                  {pass ? <SealCheck size={22} color={colors.onSuccess} weight="fill" /> : <WarningOctagon size={22} color={colors.onError} weight="fill" />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.rowTop}>
                    <Text style={s.name} numberOfLines={1}>
                      {[item.brand, item.model].filter((x: string) => x && x !== "Unknown").join(" ") || item.machine_type || "Equipment"}
                    </Text>
                    <StatusBadge label={item.outcome} bg={pass ? colors.success : colors.error} fg={pass ? colors.onSuccess : colors.onError} />
                  </View>
                  <Text style={s.meta}>{item.machine_type}{item.location ? ` · ${item.location}` : ""}</Text>
                  <Text style={s.meta}>{new Date(item.created_at).toLocaleDateString("en-AU")} · {item.assessed_by}</Text>
                </View>
                <Pressable onPress={() => del.mutate(item.id)} hitSlop={8} testID={`delete-equip-${item.id}`}>
                  <Trash size={18} color={colors.error} weight="bold" />
                </Pressable>
              </Pressable>
            );
          }}
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
  loading: { paddingVertical: 80, alignItems: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: c.muted, textAlign: "center", lineHeight: 20 },
  summaryRow: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  summaryCell: { flex: 1, padding: 20, alignItems: "center" },
  summaryDanger: { backgroundColor: c.error },
  summaryNum: { fontFamily: fonts.monoBold, fontSize: 36, color: c.onSurface },
  summaryLabel: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, letterSpacing: 1, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  iconPass: { backgroundColor: c.success },
  iconHazard: { backgroundColor: c.error },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurface },
  meta: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 2 },
}));
