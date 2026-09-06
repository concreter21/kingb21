import React, { useState } from "react";
import { View, Text, FlatList, Pressable, Modal, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Lock, LockOpen, Plus, X, Trash } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { Button, Input, StatusBadge } from "@/src/components/ui";
import { api } from "@/src/api";

export default function Registers() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["loto"], queryFn: () => api.get("/loto") });

  const release = useMutation({
    mutationFn: (id: string) => api.patch(`/loto/${id}`, { status: "released" }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["loto"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/loto/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loto"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });
  const clearAll = useMutation({
    mutationFn: () => api.post("/loto/clear-all"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loto"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const locks = data || [];
  const activeCount = locks.filter((l: any) => l.status === "locked").length;

  const renderItem = ({ item }: { item: any }) => {
    const locked = item.status === "locked";
    return (
      <View style={s.row} testID={`loto-${item.id}`}>
        <View style={[s.lockIcon, locked ? s.lockedBg : s.releasedBg]}>
          {locked ? <Lock size={22} color={colors.onError} weight="fill" /> : <LockOpen size={22} color={colors.onSuccess} weight="fill" />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.rowTop}>
            <Text style={s.machineName} numberOfLines={1}>{item.machine_name}</Text>
            <StatusBadge
              label={locked ? "LOCKED" : "RELEASED"}
              bg={locked ? colors.error : colors.success}
              fg={locked ? colors.onError : colors.onSuccess}
            />
            <Pressable onPress={() => del.mutate(item.id)} hitSlop={8} testID={`delete-loto-${item.id}`}>
              <Trash size={18} color={colors.error} weight="bold" />
            </Pressable>
          </View>
          <Text style={s.machineMeta}>ID {item.machine_id}{item.lock_number ? ` · TAG ${item.lock_number}` : ""}</Text>
          {item.location ? <Text style={s.machineMeta}>{item.location}</Text> : null}
          <Text style={s.machineMeta}>Applied by {item.applied_by}</Text>
          {locked ? (
            <Pressable style={s.releaseBtn} onPress={() => release.mutate(item.id)} testID={`release-${item.id}`}>
              <Text style={s.releaseText}>RELEASE LOCK</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={s.title}>LOTO REGISTER</Text>
          <Text style={s.subtitle}>{activeCount} active lockout / tagout</Text>
        </View>
        <View style={s.headerRight}>
          {locks.length > 0 ? (
            <Pressable onPress={() => clearAll.mutate()} testID="clear-all-loto"><Text style={s.clearAll}>CLEAR</Text></Pressable>
          ) : null}
          <Pressable style={s.addBtn} onPress={() => setShowForm(true)} testID="add-loto">
            <Plus size={22} color={colors.onBrandPrimary} weight="bold" />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color={colors.onSurface} /></View>
      ) : locks.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyBig}>NO ACTIVE{"\n"}LOTO LOCKS</Text>
          <Text style={s.emptySub}>Register a lockout to isolate machinery for maintenance.</Text>
          <Button title="REGISTER LOCK" onPress={() => setShowForm(true)} testID="empty-register-lock" style={{ marginTop: 20 }} />
        </View>
      ) : (
        <FlatList
          data={locks}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <LotoForm visible={showForm} onClose={() => setShowForm(false)} />
    </View>
  );
}

function LotoForm({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [machine_name, setName] = useState("");
  const [machine_id, setId] = useState("");
  const [location, setLocation] = useState("");
  const [lock_number, setLock] = useState("");
  const [reason, setReason] = useState("");

  const reset = () => { setName(""); setId(""); setLocation(""); setLock(""); setReason(""); };

  const create = useMutation({
    mutationFn: () => api.post("/loto", { machine_name, machine_id, location, lock_number, reason }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["loto"] });
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
            <Text style={s.modalTitle}>REGISTER LOCK</Text>
            <Pressable onPress={onClose} testID="close-loto-form"><X size={24} color={colors.onSurface} weight="bold" /></Pressable>
          </View>
          <KeyboardAwareScrollView contentContainerStyle={{ gap: 14, padding: 20 }} bottomOffset={20} showsVerticalScrollIndicator={false}>
            <Input label="Machine / Plant Name" value={machine_name} onChangeText={setName} placeholder="Blast Freezer #2" testID="loto-name" />
            <Input label="Machine ID" value={machine_id} onChangeText={setId} placeholder="BF-002" testID="loto-id" />
            <Input label="Lock / Tag Number" value={lock_number} onChangeText={setLock} placeholder="TK-0451" testID="loto-tag" />
            <Input label="Location" value={location} onChangeText={setLocation} placeholder="Cold store, Bay 4" testID="loto-location" />
            <Input label="Reason" value={reason} onChangeText={setReason} placeholder="Belt replacement" testID="loto-reason" multiline />
            <Button
              title="APPLY LOCKOUT"
              onPress={() => machine_name && machine_id && create.mutate()}
              loading={create.isPending}
              disabled={!machine_name || !machine_id}
              testID="submit-loto"
            />
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: {
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: c.borderStrong,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", backgroundColor: c.surface,
  },
  title: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface },
  subtitle: { fontFamily: fonts.mono, fontSize: 12, color: c.muted, marginTop: 2 },
  addBtn: { width: 44, height: 44, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.borderStrong },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  clearAll: { fontFamily: fonts.monoBold, fontSize: 12, color: c.error, letterSpacing: 1 },
  loading: { paddingVertical: 80, alignItems: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyBig: { fontFamily: fonts.display, fontSize: 32, color: c.onSurface, textAlign: "center", letterSpacing: -1 },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: c.muted, textAlign: "center", marginTop: 12 },
  row: { flexDirection: "row", gap: 14, padding: 20, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  lockIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  lockedBg: { backgroundColor: c.error },
  releasedBg: { backgroundColor: c.success },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  machineName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 16, color: c.onSurface },
  machineMeta: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 2 },
  releaseBtn: { marginTop: 10, borderWidth: 2, borderColor: c.borderStrong, paddingVertical: 8, alignItems: "center" },
  releaseText: { fontFamily: fonts.monoBold, fontSize: 12, color: c.onSurface, letterSpacing: 1 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: c.surface, borderTopWidth: 3, borderColor: c.borderStrong, maxHeight: "88%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  modalTitle: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface, letterSpacing: 0.5 },
}));
