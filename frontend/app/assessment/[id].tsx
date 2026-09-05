import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { CaretLeft, FilePdf, CheckCircle } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { RiskBadge, SectionLabel } from "@/src/components/ui";
import { api, fileUrl } from "@/src/api";
import { exportPdf } from "@/src/pdf";

const MODE_NAMES: Record<string, string> = {
  risk: "LIVE RISK ASSESSMENT",
  swms: "SAFE WORK METHOD STATEMENT",
  density: "WORKER DENSITY ASSESSMENT",
  machinery: "MACHINERY SAFETY ASSESSMENT",
};

export default function AssessmentDetail() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [photoUri, setPhotoUri] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data: a, isLoading } = useQuery({ queryKey: ["assessment", id], queryFn: () => api.get(`/assessments/${id}`) });

  useEffect(() => {
    if (a?.photo_path) fileUrl(a.photo_path).then(setPhotoUri);
  }, [a?.photo_path]);

  const onExport = async () => {
    if (!a) return;
    setExporting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await exportPdf(a);
    } catch {
      /* ignore */
    } finally {
      setExporting(false);
    }
  };

  if (isLoading || !a) {
    return (
      <View style={[s.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.onSurface} />
      </View>
    );
  }

  const r = a.result || {};

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="detail-back">
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={s.headerLabel} numberOfLines={1}>{MODE_NAMES[a.mode] || "ASSESSMENT"}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={s.photo} contentFit="cover" transition={200} />
        ) : null}

        <View style={s.body}>
          <Text style={s.title}>{r.title || a.title}</Text>
          <Text style={s.meta}>{new Date(a.created_at).toLocaleString("en-AU")} · {a.user_name}</Text>

          <View style={s.overallRow}>
            <Text style={s.overallLabel}>OVERALL RISK</Text>
            <RiskBadge level={r.overall_risk_level} testID="overall-risk" />
          </View>

          <View style={s.summaryBox}>
            <Text style={s.summaryText}>{r.summary}</Text>
          </View>

          {/* Hazards */}
          {(r.hazards || []).length > 0 && (
            <>
              <View style={s.sectionHead}><SectionLabel>Hazard & Risk Register</SectionLabel></View>
              {r.hazards.map((h: any, i: number) => (
                <View key={i} style={s.hazardCard} testID={`hazard-${i}`}>
                  <View style={s.hazardTop}>
                    <Text style={s.hazardName}>{h.hazard}</Text>
                    <RiskBadge level={h.risk_level} />
                  </View>
                  <Text style={s.hazardMeta}>Likelihood: {h.likelihood} · Consequence: {h.consequence}</Text>
                  {(h.controls || []).map((ctrl: string, ci: number) => (
                    <View key={ci} style={s.controlRow}>
                      <Text style={s.controlBullet}>›</Text>
                      <Text style={s.controlText}>{ctrl}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}

          {/* SWMS */}
          {(r.swms_steps || []).length > 0 && (
            <>
              <View style={s.sectionHead}><SectionLabel>SWMS Task Steps</SectionLabel></View>
              {r.swms_steps.map((step: any, i: number) => (
                <View key={i} style={s.swmsCard} testID={`swms-${i}`}>
                  <Text style={s.swmsStep}>{i + 1}. {step.step}</Text>
                  <Text style={s.swmsLine}><Text style={s.swmsKey}>HAZARDS: </Text>{step.hazards}</Text>
                  <Text style={s.swmsLine}><Text style={s.swmsKey}>CONTROLS: </Text>{step.controls}</Text>
                  <Text style={s.swmsLine}><Text style={s.swmsKey}>PPE: </Text>{step.ppe}</Text>
                </View>
              ))}
            </>
          )}

          {/* Density */}
          {r.density && (
            <>
              <View style={s.sectionHead}><SectionLabel>Worker Density</SectionLabel></View>
              <View style={s.infoCard}>
                <View style={s.densityTop}>
                  <View>
                    <Text style={s.bigNum}>{r.density.people_count}</Text>
                    <Text style={s.bigNumLabel}>PEOPLE</Text>
                  </View>
                  <RiskBadge level={r.density.density_rating} />
                </View>
                <Text style={s.infoLine}>{r.density.area_note}</Text>
                <Text style={s.infoLineBold}>{r.density.recommendation}</Text>
              </View>
            </>
          )}

          {/* Machinery */}
          {r.machinery && (
            <>
              <View style={s.sectionHead}><SectionLabel>Machinery Safety</SectionLabel></View>
              <View style={s.infoCard}>
                <Text style={s.infoLine}><Text style={s.swmsKey}>MACHINE: </Text>{r.machinery.machine_type}</Text>
                <Text style={s.infoLine}><Text style={s.swmsKey}>GUARDING: </Text>{r.machinery.guarding_status}</Text>
                <Text style={s.infoLine}><Text style={s.swmsKey}>ISOLATION: </Text>{r.machinery.isolation_note}</Text>
                <Text style={s.infoLine}><Text style={s.swmsKey}>AS 4024: </Text>{r.machinery.compliance_note}</Text>
              </View>
            </>
          )}

          {/* Actions */}
          {(r.recommended_actions || []).length > 0 && (
            <>
              <View style={s.sectionHead}><SectionLabel>Recommended Actions</SectionLabel></View>
              <View style={s.actionsCard}>
                {r.recommended_actions.map((act: string, i: number) => (
                  <View key={i} style={s.actionRow}>
                    <CheckCircle size={18} color={colors.success} weight="fill" />
                    <Text style={s.actionText}>{act}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Legislation */}
          {(r.legislation_refs || []).length > 0 && (
            <>
              <View style={s.sectionHead}><SectionLabel>Legislative References</SectionLabel></View>
              <View style={s.legisCard}>
                {r.legislation_refs.map((ref: string, i: number) => (
                  <Text key={i} style={s.legisText}>• {ref}</Text>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Sticky export bar */}
      <View style={[s.exportBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={s.exportBtn} onPress={onExport} disabled={exporting} testID="export-pdf">
          {exporting ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <FilePdf size={22} color={colors.onBrandPrimary} weight="bold" />
              <Text style={s.exportText}>EXPORT PDF</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: c.borderStrong, backgroundColor: c.surface, gap: 12 },
  back: { width: 22 },
  headerLabel: { flex: 1, fontFamily: fonts.monoBold, fontSize: 13, color: c.onSurface, letterSpacing: 1, textAlign: "center" },
  photo: { width: "100%", height: 220, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  body: { padding: 20 },
  title: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface, letterSpacing: -0.5 },
  meta: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 4 },
  overallRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, borderWidth: 2, borderColor: c.borderStrong, padding: 14 },
  overallLabel: { fontFamily: fonts.monoBold, fontSize: 13, color: c.onSurface, letterSpacing: 1 },
  summaryBox: { marginTop: 16, backgroundColor: c.surfaceSecondary, padding: 14, borderLeftWidth: 4, borderLeftColor: c.borderStrong },
  summaryText: { fontFamily: fonts.body, fontSize: 14, color: c.onSurfaceSecondary, lineHeight: 21 },
  sectionHead: { marginTop: 28, marginBottom: 12 },
  hazardCard: { borderWidth: 2, borderColor: c.borderStrong, padding: 14, marginBottom: 12 },
  hazardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  hazardName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurface },
  hazardMeta: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 6 },
  controlRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  controlBullet: { fontFamily: fonts.monoBold, fontSize: 14, color: c.success },
  controlText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 19 },
  swmsCard: { borderWidth: 2, borderColor: c.borderStrong, padding: 14, marginBottom: 12 },
  swmsStep: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurface, marginBottom: 8 },
  swmsLine: { fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 20, marginTop: 2 },
  swmsKey: { fontFamily: fonts.monoBold, fontSize: 11, color: c.muted },
  infoCard: { borderWidth: 2, borderColor: c.borderStrong, padding: 14, gap: 6 },
  densityTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  bigNum: { fontFamily: fonts.monoBold, fontSize: 44, color: c.onSurface },
  bigNumLabel: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, letterSpacing: 1 },
  infoLine: { fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 20 },
  infoLineBold: { fontFamily: fonts.bodySemi, fontSize: 14, color: c.onSurface, marginTop: 4 },
  actionsCard: { borderWidth: 2, borderColor: c.borderStrong, padding: 14, gap: 10 },
  actionRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  actionText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 19 },
  legisCard: { backgroundColor: c.surfaceSecondary, padding: 14, gap: 6 },
  legisText: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurfaceSecondary, lineHeight: 18 },
  exportBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 2, borderTopColor: c.borderStrong, backgroundColor: c.surface },
  exportBtn: { minHeight: 54, backgroundColor: c.brandPrimary, borderWidth: 2, borderColor: c.borderStrong, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  exportText: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onBrandPrimary, letterSpacing: 0.5 },
}));
