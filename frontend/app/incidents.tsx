import React, { useState } from "react";
import { View, Text, FlatList, Pressable, Modal, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CaretLeft, Plus, X, Warning, Trash } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { Button, Input, StatusBadge } from "@/src/components/ui";
import { api } from "@/src/api";

const CATEGORIES = ["Near Miss", "Injury", "Hazard", "Property Damage", "Environmental"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];

function sevColor(sev: string, c: any) {
  switch (sev.toLowerCase()) {
    case "low": return { bg: c.success, fg: c.onSuccess };
    case "medium": return { bg: c.warning, fg: c.onWarning };
    case "high": return { bg: c.error, fg: c.onError };
    case "critical": return { bg: c.critical, fg: c.onCritical };
    default: return { bg: c.surfaceTertiary, fg: c.onSurfaceTertiary };
  }
}

export default function Incidents() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["incidents"], queryFn: () => api.get("/incidents") });

  const resolve = useMutation({
    mutationFn: (id: string) => api.patch(`/incidents/${id}?status=closed`),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/incidents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incidents"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });
  const clearAll = useMutation({
    mutationFn: () => api.post("/incidents/clear-all"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incidents"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const items = data || [];

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="incidents-back">
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={s.headerLabel}>INCIDENTS</Text>
        <View style={s.headerRight}>
          {items.length > 0 ? (
            <Pressable onPress={() => clearAll.mutate()} testID="clear-all-incidents"><Text style={s.clearAll}>CLEAR</Text></Pressable>
          ) : null}
          <Pressable onPress={() => setShowForm(true)} style={s.addBtn} testID="add-incident">
            <Plus size={20} color={colors.onBrandPrimary} weight="bold" />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color={colors.onSurface} /></View>
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Warning size={48} color={colors.muted} weight="bold" />
          <Text style={s.emptyText}>No incidents reported. A safe site is a productive site.</Text>
          <Button title="REPORT INCIDENT" onPress={() => setShowForm(true)} testID="empty-report" style={{ marginTop: 20 }} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const sc = sevColor(item.severity, colors);
            const open = item.status === "open";
            return (
              <View style={s.row} testID={`incident-${item.id}`}>
                <View style={s.rowTop}>
                  <Text style={s.incTitle} numberOfLines={1}>{item.title}</Text>
                  <StatusBadge label={item.severity} bg={sc.bg} fg={sc.fg} />
                </View>
                <Text style={s.incMeta}>{item.category}{item.location ? ` · ${item.location}` : ""}</Text>
                {item.description ? <Text style={s.incDesc}>{item.description}</Text> : null}
                <View style={s.rowBottom}>
                  <Text style={s.incMeta}>{item.reported_by} · {new Date(item.created_at).toLocaleDateString("en-AU")}</Text>
                  <View style={s.rowActions}>
                    {open ? (
                      <Pressable onPress={() => resolve.mutate(item.id)} style={s.resolveBtn} testID={`resolve-${item.id}`}>
                        <Text style={s.resolveText}>MARK CLOSED</Text>
                      </Pressable>
                    ) : (
                      <StatusBadge label="CLOSED" bg={colors.surfaceInverse} fg={colors.onSurfaceInverse} />
                    )}
                    <Pressable onPress={() => del.mutate(item.id)} hitSlop={8} testID={`delete-incident-${item.id}`}>
                      <Trash size={18} color={colors.error} weight="bold" />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      <IncidentForm visible={showForm} onClose={() => setShowForm(false)} />
    </View>
  );
}

function IncidentForm({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Near Miss");
  const [severity, setSeverity] = useState("Low");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const reset = () => { setTitle(""); setCategory("Near Miss"); setSeverity("Low"); setLocation(""); setDescription(""); };

  const create = useMutation({
    mutationFn: () => api.post("/incidents", { title, category, severity, location, description }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      onClose();
    },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={[s.modalCard, { paddingBottom: insets.bottom + 20 }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>REPORT INCIDENT</Text>
            <Pressable onPress={onClose} testID="close-incident"><X size={24} color={colors.onSurface} weight="bold" /></Pressable>
          </View>
          <KeyboardAwareScrollView contentContainerStyle={{ gap: 14, padding: 20 }} bottomOffset={20} showsVerticalScrollIndicator={false}>
            <Input label="Title" value={title} onChangeText={setTitle} placeholder="Spill near loading dock" testID="incident-title" />
            <View style={{ gap: 8 }}>
              <Text style={s.label}>CATEGORY</Text>
              <View style={s.chipWrap}>
                {CATEGORIES.map((cat) => (
                  <Pressable key={cat} onPress={() => setCategory(cat)} style={[s.chip, category === cat && s.chipActive]} testID={`cat-${cat}`}>
                    <Text style={[s.chipText, category === cat && s.chipTextActive]}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={s.label}>SEVERITY</Text>
              <View style={s.chipWrap}>
                {SEVERITIES.map((sev) => {
                  const sc = sevColor(sev, colors);
                  const active = severity === sev;
                  return (
                    <Pressable key={sev} onPress={() => setSeverity(sev)} style={[s.chip, active && { backgroundColor: sc.bg, borderColor: sc.bg }]} testID={`sev-${sev}`}>
                      <Text style={[s.chipText, active && { color: sc.fg }]}>{sev}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Input label="Location" value={location} onChangeText={setLocation} placeholder="Loading dock, Bay 2" testID="incident-location" />
            <Input label="Description" value={description} onChangeText={setDescription} placeholder="Describe what happened" multiline testID="incident-desc" />
            <Button title="SUBMIT REPORT" onPress={() => title && create.mutate()} loading={create.isPending} disabled={!title} testID="submit-incident" />
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  clearAll: { fontFamily: fonts.monoBold, fontSize: 12, color: c.error, letterSpacing: 1 },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  addBtn: { width: 36, height: 36, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  loading: { paddingVertical: 80, alignItems: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: c.muted, textAlign: "center" },
  row: { padding: 20, borderBottomWidth: 2, borderBottomColor: c.borderStrong, gap: 6 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  incTitle: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 16, color: c.onSurface },
  incMeta: { fontFamily: fonts.mono, fontSize: 11, color: c.muted },
  incDesc: { fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 19 },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  resolveBtn: { borderWidth: 2, borderColor: c.borderStrong, paddingHorizontal: 12, paddingVertical: 6 },
  resolveText: { fontFamily: fonts.monoBold, fontSize: 11, color: c.onSurface, letterSpacing: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: c.surface, borderTopWidth: 3, borderColor: c.borderStrong, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  modalTitle: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface, letterSpacing: 0.5 },
  label: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, letterSpacing: 1 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 2, borderColor: c.borderStrong, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.surface },
  chipActive: { backgroundColor: c.brandPrimary },
  chipText: { fontFamily: fonts.bodyMed, fontSize: 13, color: c.onSurface },
  chipTextActive: { color: c.onBrandPrimary },
}));
