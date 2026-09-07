import React, { useCallback, useRef, useState } from "react";
import { View, Text, Pressable, Linking, ActivityIndicator, Modal, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Image as ImageIcon, Warning, ArrowClockwise, WarningOctagon, ClipboardText, UsersThree, Gear, Sparkle, CaretDown, X, Check, FileText } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { Button } from "@/src/components/ui";
import { api } from "@/src/api";
import { storage } from "@/src/utils/storage";

type Template = { id: string; name: string; department: string; machine: string; site: string; hazard_count: number };

const MODES = [
  { key: "risk", label: "Risk", hint: "Live risk assessment", icon: WarningOctagon },
  { key: "swms", label: "SWMS", hint: "Safe work method statement", icon: ClipboardText },
  { key: "density", label: "Density", hint: "Worker density & spacing", icon: UsersThree },
  { key: "machinery", label: "Machine", hint: "ID equipment & spec-check", icon: Gear },
];

export default function Assess() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState("risk");
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [templateModal, setTemplateModal] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);

  const templatesEnabled = mode === "risk" || mode === "swms";
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["risk-templates"],
    queryFn: () => api.get("/risk-templates"),
    enabled: aiEnabled,
    staleTime: 1000 * 60 * 30,
  });

  useFocusEffect(
    useCallback(() => {
      storage.getItem<boolean>("tk_ai_assist", true).then((v) => setAiEnabled(v ?? true));
    }, [])
  );

  const activeMode = MODES.find((m) => m.key === mode)!;

  const analyse = async (image_base64?: string) => {
    setError("");
    setAnalysing(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const doc = await api.post("/ai/assess", {
        mode,
        image_base64: image_base64 || null,
        location: "",
        notes: "",
        template_id: templatesEnabled ? template?.id || null : null,
      });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["assessments"] });
      router.push(`/assessment/${doc.id}` as any);
    } catch (e: any) {
      setError(e.message || "AI analysis failed. Please retake the photo.");
    } finally {
      setAnalysing(false);
    }
  };

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      if (photo?.base64) await analyse(photo.base64);
    } catch {
      setError("Could not capture photo. Try uploading from gallery.");
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Gallery permission is required to upload a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.5,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      await analyse(result.assets[0].base64);
    }
  };

  const renderViewfinder = () => {
    // Permission undetermined
    if (!permission) {
      return (
        <View style={s.permBox}>
          <ActivityIndicator color={colors.onBrandPrimary} />
        </View>
      );
    }
    if (!permission.granted) {
      return (
        <View style={s.permBox}>
          <Camera size={48} color={colors.onBrandPrimary} weight="bold" />
          <Text style={s.permTitle}>CAMERA ACCESS</Text>
          <Text style={s.permText}>
            TK SafetyGuard uses your camera to capture hazards and machinery for instant AI safety analysis.
          </Text>
          {permission.canAskAgain ? (
            <Pressable style={s.permBtn} onPress={requestPermission} testID="enable-camera">
              <Text style={s.permBtnText}>ENABLE CAMERA</Text>
            </Pressable>
          ) : (
            <Pressable style={s.permBtn} onPress={() => Linking.openSettings()} testID="open-settings">
              <Text style={s.permBtnText}>OPEN SETTINGS</Text>
            </Pressable>
          )}
          <Text style={s.permOr}>or upload a photo below</Text>
        </View>
      );
    }
    return (
      <View style={s.cameraWrap}>
        <CameraView ref={cameraRef} style={s.camera} facing="back" />
        {/* Corner brackets */}
        <View style={s.overlay} pointerEvents="none">
          <View style={[s.corner, s.tl]} />
          <View style={[s.corner, s.tr]} />
          <View style={[s.corner, s.bl]} />
          <View style={[s.corner, s.br]} />
        </View>
        {analysing ? (
          <View style={s.analysing} pointerEvents="none">
            <ActivityIndicator color="#FFFFFF" size="large" />
            <Text style={s.analysingText}>ANALYSING {activeMode.label.toUpperCase()}...</Text>
            <Text style={s.analysingSub}>AI reviewing against WHS Act 2011</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={s.container}>
      {/* Sticky header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>AI ASSESS</Text>
        <Text style={s.subtitle}>{activeMode.hint}</Text>
        <View style={s.segment}>
          {MODES.map((m) => {
            const active = m.key === mode;
            const Icon = m.icon;
            return (
              <Pressable
                key={m.key}
                testID={`mode-${m.key}`}
                onPress={() => setMode(m.key)}
                disabled={analysing}
                style={[s.segItem, active && s.segItemActive]}
              >
                <Icon size={22} color={active ? colors.onBrandPrimary : colors.onSurface} weight={active ? "fill" : "regular"} />
                <Text style={[s.segLabel, active && s.segLabelActive]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {templatesEnabled && aiEnabled ? (
          <Pressable style={s.tmplSelect} onPress={() => setTemplateModal(true)} testID="template-select">
            <FileText size={18} color={template ? colors.brandPrimary : colors.muted} weight="bold" />
            <View style={{ flex: 1 }}>
              <Text style={s.tmplSelectLabel}>{template ? "TEMPLATE" : "TEMPLATE (OPTIONAL)"}</Text>
              <Text style={s.tmplSelectValue} numberOfLines={1}>
                {template ? template.name : "AI from photo only — tap to pick a company template"}
              </Text>
            </View>
            {template ? (
              <Pressable hitSlop={10} onPress={() => setTemplate(null)} testID="template-clear">
                <X size={18} color={colors.muted} weight="bold" />
              </Pressable>
            ) : (
              <CaretDown size={18} color={colors.muted} weight="bold" />
            )}
          </Pressable>
        ) : null}
      </View>

      {!aiEnabled ? (
        <View style={s.disabledWrap} testID="ai-disabled">
          <Sparkle size={48} color={colors.muted} weight="bold" />
          <Text style={s.disabledTitle}>AI ASSIST IS OFF</Text>
          <Text style={s.disabledText}>Turn on AI Assist in Settings to run camera-based safety assessments.</Text>
          <Button title="OPEN SETTINGS" variant="outline" onPress={() => router.push("/settings" as any)} testID="ai-open-settings" style={{ marginTop: 8 }} />
        </View>
      ) : (
        <>
          {renderViewfinder()}

          {/* Bottom action panel */}
          <View style={[s.panel, { paddingBottom: insets.bottom + 16 }]}>
            {error ? (
              <View style={s.errorBox} testID="assess-error">
                <Warning size={16} color={colors.onError} weight="fill" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}
            {templatesEnabled && template ? (
              <Pressable
                style={[s.genBtn, analysing && s.captureDisabled]}
                onPress={() => analyse()}
                disabled={analysing}
                testID="generate-from-template"
              >
                <Sparkle size={20} color={colors.onSurface} weight="fill" />
                <Text style={s.genBtnText}>GENERATE FROM TEMPLATE (NO PHOTO)</Text>
              </Pressable>
            ) : null}
            <View style={s.actions}>
          <Pressable
            style={[s.captureBtn, (analysing || !permission?.granted) && s.captureDisabled]}
            onPress={capture}
            disabled={analysing || !permission?.granted}
            testID="capture-button"
          >
            {analysing ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Camera size={22} color={colors.onBrandPrimary} weight="bold" />
                <Text style={s.captureText}>CAPTURE & ANALYSE</Text>
              </>
            )}
          </Pressable>
          <Pressable style={s.galleryBtn} onPress={pickImage} disabled={analysing} testID="gallery-button">
            {analysing ? <ArrowClockwise size={22} color={colors.onSurface} /> : <ImageIcon size={22} color={colors.onSurface} weight="bold" />}
          </Pressable>
            </View>
          </View>
        </>
      )}

      <Modal visible={templateModal} animationType="slide" transparent onRequestClose={() => setTemplateModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>RISK TEMPLATES</Text>
                <Text style={s.modalSub}>The Kitchenary machine & process assessments</Text>
              </View>
              <Pressable hitSlop={10} onPress={() => setTemplateModal(false)} testID="template-modal-close">
                <X size={24} color={colors.onSurface} weight="bold" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Pressable
                style={[s.tmplRow, !template && s.tmplRowActive]}
                onPress={() => { setTemplate(null); setTemplateModal(false); }}
                testID="template-none"
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.tmplRowName}>No template</Text>
                  <Text style={s.tmplRowMeta}>AI assesses from the photo only</Text>
                </View>
                {!template ? <Check size={20} color={colors.brandPrimary} weight="bold" /> : null}
              </Pressable>
              {templates.map((t) => {
                const active = template?.id === t.id;
                return (
                  <Pressable
                    key={t.id}
                    style={[s.tmplRow, active && s.tmplRowActive]}
                    onPress={() => { setTemplate(t); setTemplateModal(false); }}
                    testID={`template-${t.id}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.tmplRowName}>{t.name}</Text>
                      <Text style={s.tmplRowMeta}>{t.department} · {t.hazard_count} known hazards</Text>
                    </View>
                    {active ? <Check size={20} color={colors.brandPrimary} weight="bold" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: c.borderStrong,
    backgroundColor: c.surface,
  },
  title: { fontFamily: fonts.display, fontSize: 26, color: c.onSurface },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: c.muted, marginTop: 2 },
  disabledWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  disabledTitle: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface, letterSpacing: 0.5 },
  disabledText: { fontFamily: fonts.body, fontSize: 14, color: c.muted, textAlign: "center", lineHeight: 20 },
  chipScroll: { marginTop: 14, marginHorizontal: -20 },
  chipRow: { gap: 8, paddingHorizontal: 20 },
  segment: { flexDirection: "row", marginTop: 14, borderWidth: 2, borderColor: c.borderStrong },
  segItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    backgroundColor: c.surface,
    borderRightWidth: 2,
    borderRightColor: c.borderStrong,
  },
  segItemActive: { backgroundColor: c.brandPrimary },
  segLabel: { fontFamily: fonts.monoBold, fontSize: 11, color: c.onSurface, letterSpacing: 0.5 },
  segLabelActive: { color: c.onBrandPrimary },

  tmplSelect: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
  },
  tmplSelectLabel: { fontFamily: fonts.mono, fontSize: 9, color: c.muted, letterSpacing: 1 },
  tmplSelectValue: { fontFamily: fonts.bodySemi, fontSize: 13, color: c.onSurface, marginTop: 1 },

  genBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 52,
    borderWidth: 2,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
  },
  genBtnText: { fontFamily: fonts.bodySemi, fontSize: 13, color: c.onSurface, letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: c.surface, borderTopWidth: 2, borderTopColor: c.borderStrong, paddingHorizontal: 20, paddingTop: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: c.borderStrong, marginBottom: 8 },
  modalTitle: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface, letterSpacing: 0.5 },
  modalSub: { fontFamily: fonts.body, fontSize: 12, color: c.muted, marginTop: 2 },
  tmplRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  tmplRowActive: { backgroundColor: c.brandPrimary + "12" },
  tmplRowName: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurface },
  tmplRowMeta: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 2, letterSpacing: 0.5 },

  permBox: { flex: 1, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  permTitle: { fontFamily: fonts.display, fontSize: 18, color: c.onSurface, letterSpacing: 1 },
  permText: { fontFamily: fonts.body, fontSize: 13, color: c.muted, textAlign: "center", lineHeight: 20 },
  permBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  permBtnText: { fontFamily: fonts.monoBold, fontSize: 13, color: c.onBrandPrimary, letterSpacing: 1 },
  permOr: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 4 },

  cameraWrap: { flex: 1, backgroundColor: "#000000" },
  camera: { flex: 1 },
  overlay: { ...StyleSheetAbsolute() },
  corner: { position: "absolute", width: 32, height: 32, borderColor: "#FFFFFF" },
  tl: { top: 24, left: 24, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 24, right: 24, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 24, left: 24, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 24, right: 24, borderBottomWidth: 3, borderRightWidth: 3 },
  analysing: { ...StyleSheetAbsolute(), backgroundColor: "rgba(17,17,17,0.82)", alignItems: "center", justifyContent: "center", gap: 10 },
  analysingText: { fontFamily: fonts.monoBold, fontSize: 16, color: "#FFFFFF", letterSpacing: 2 },
  analysingSub: { fontFamily: fonts.mono, fontSize: 11, color: "#FFFFFF", opacity: 0.7 },

  panel: { paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 2, borderTopColor: c.borderStrong, backgroundColor: c.surface, gap: 12 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.error, padding: 10 },
  errorText: { flex: 1, fontFamily: fonts.bodyMed, fontSize: 12, color: c.onError },
  actions: { flexDirection: "row", gap: 12 },
  captureBtn: {
    flex: 1,
    minHeight: 56,
    backgroundColor: c.brandPrimary,
    borderWidth: 2,
    borderColor: c.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  captureDisabled: { opacity: 0.4 },
  captureText: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onBrandPrimary, letterSpacing: 0.5 },
  galleryBtn: { width: 56, height: 56, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: c.surface },
}));

function StyleSheetAbsolute() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
}
