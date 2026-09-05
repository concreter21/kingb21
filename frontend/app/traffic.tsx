import React, { useState } from "react";
import { View, Text, FlatList, Pressable, Modal, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CaretLeft, Plus, X, PersonSimpleWalk, Truck, Warning, Package } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { Button, Input, StatusBadge } from "@/src/components/ui";
import { api } from "@/src/api";

const ZONE_TYPES = [
  { key: "pedestrian", label: "Pedestrian", icon: PersonSimpleWalk },
  { key: "forklift", label: "Forklift", icon: Truck },
  { key: "shared", label: "Shared", icon: Warning },
  { key: "loading", label: "Loading", icon: Package },
];

function zoneMeta(type: string, c: any) {
  switch (type) {
    case "pedestrian": return { bg: c.success, fg: c.onSuccess, Icon: PersonSimpleWalk };
    case "forklift": return { bg: c.error, fg: c.onError, Icon: Truck };
    case "shared": return { bg: c.warning, fg: c.onWarning, Icon: Warning };
    case "loading": return { bg: c.surfaceInverse, fg: c.onSurfaceInverse, Icon: Package };
    default: return { bg: c.surfaceTertiary, fg: c.onSurfaceTertiary, Icon: Warning };
  }
}

export default function Traffic() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["traffic"], queryFn: () => api.get("/traffic") });
  const items = data || [];

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="traffic-back">
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={s.headerLabel}>TRAFFIC MGMT</Text>
        <Pressable onPress={() => setShowForm(true)} style={s.addBtn} testID="add-zone">
          <Plus size={20} color={colors.onBrandPrimary} weight="bold" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color={colors.onSurface} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.legend}>
              <Text style={s.legendTitle}>WAREHOUSE TRAFFIC ZONES</Text>
              <Text style={s.legendSub}>Separate pedestrians from mobile plant per WHS forklift Code of Practice.</Text>
            </View>
          }
          ListEmptyComponent={<View style={s.emptyBox}><Text style={s.emptyText}>No zones defined. Add pedestrian and forklift zones to map site traffic.</Text></View>}
          renderItem={({ item }) => {
            const zm = zoneMeta(item.zone_type, colors);
            const Icon = zm.Icon;
            return (
              <View style={s.row} testID={`zone-${item.id}`}>
                <View style={[s.zoneIcon, { backgroundColor: zm.bg }]}>
                  <Icon size={24} color={zm.fg} weight="bold" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.rowTop}>
                    <Text style={s.zoneName} numberOfLines={1}>{item.zone_name}</Text>
                    <StatusBadge label={item.zone_type} bg={zm.bg} fg={zm.fg} />
                  </View>
                  {item.risk_note ? <Text style={s.zoneLine}><Text style={s.zoneKey}>RISK: </Text>{item.risk_note}</Text> : null}
                  {item.controls ? <Text style={s.zoneLine}><Text style={s.zoneKey}>CONTROLS: </Text>{item.controls}</Text> : null}
                </View>
              </View>
            );
          }}
        />
      )}

      <ZoneForm visible={showForm} onClose={() => setShowForm(false)} />
    </View>
  );
}

function ZoneForm({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [zone_name, setName] = useState("");
  const [zone_type, setType] = useState("pedestrian");
  const [risk_note, setRisk] = useState("");
  const [controls, setControls] = useState("");

  const reset = () => { setName(""); setType("pedestrian"); setRisk(""); setControls(""); };

  const create = useMutation({
    mutationFn: () => api.post("/traffic", { zone_name, zone_type, risk_note, controls }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["traffic"] });
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
            <Text style={s.modalTitle}>ADD TRAFFIC ZONE</Text>
            <Pressable onPress={onClose} testID="close-zone"><X size={24} color={colors.onSurface} weight="bold" /></Pressable>
          </View>
          <KeyboardAwareScrollView contentContainerStyle={{ gap: 14, padding: 20 }} bottomOffset={20} showsVerticalScrollIndicator={false}>
            <Input label="Zone Name" value={zone_name} onChangeText={setName} placeholder="North dispatch aisle" testID="zone-name" />
            <View style={{ gap: 8 }}>
              <Text style={s.label}>ZONE TYPE</Text>
              <View style={s.chipWrap}>
                {ZONE_TYPES.map((z) => {
                  const active = zone_type === z.key;
                  const zm = zoneMeta(z.key, colors);
                  return (
                    <Pressable key={z.key} onPress={() => setType(z.key)} style={[s.chip, active && { backgroundColor: zm.bg, borderColor: zm.bg }]} testID={`zonetype-${z.key}`}>
                      <Text style={[s.chipText, active && { color: zm.fg }]}>{z.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Input label="Risk Note" value={risk_note} onChangeText={setRisk} placeholder="Blind corner near racking" multiline testID="zone-risk" />
            <Input label="Controls" value={controls} onChangeText={setControls} placeholder="Convex mirror, give-way line, 5km/h limit" multiline testID="zone-controls" />
            <Button title="SAVE ZONE" onPress={() => zone_name && create.mutate()} loading={create.isPending} disabled={!zone_name} testID="submit-zone" />
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
  addBtn: { width: 36, height: 36, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  loading: { paddingVertical: 80, alignItems: "center" },
  legend: { padding: 20, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  legendTitle: { fontFamily: fonts.display, fontSize: 18, color: c.onSurface },
  legendSub: { fontFamily: fonts.body, fontSize: 13, color: c.muted, marginTop: 4, lineHeight: 19 },
  emptyBox: { padding: 24 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: c.muted, lineHeight: 20 },
  row: { flexDirection: "row", gap: 14, padding: 20, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  zoneIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  zoneName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 16, color: c.onSurface },
  zoneLine: { fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 19, marginTop: 4 },
  zoneKey: { fontFamily: fonts.monoBold, fontSize: 11, color: c.muted },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: c.surface, borderTopWidth: 3, borderColor: c.borderStrong, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  modalTitle: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface, letterSpacing: 0.5 },
  label: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, letterSpacing: 1 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 2, borderColor: c.borderStrong, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.surface },
  chipText: { fontFamily: fonts.bodyMed, fontSize: 13, color: c.onSurface },
}));
