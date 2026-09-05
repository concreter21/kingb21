import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { CaretLeft, FilePdf, CheckCircle, SealCheck, Clock, WarningOctagon } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { RiskBadge, SectionLabel, StatusBadge } from "@/src/components/ui";
import { api, fileUrl } from "@/src/api";
import { exportPdf } from "@/src/pdf";
import { useAuth } from "@/src/auth";

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
  const { user } = useAuth();
  const qc = useQueryClient();
  const [photoUri, setPhotoUri] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data: a, isLoading } = useQuery({ queryKey: ["assessment", id], queryFn: () => api.get(`/assessments/${id}`) });

  const approve = useMutation({
    mutationFn: () => api.patch(`/assessments/${id}/approve`),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["assessment", id] });
      qc.invalidateQueries({ queryKey: ["assessments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

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
  const approved = a.status === "approved";
  const canApprove = !approved && (user?.role === "Safety Officer" || user?.role === "Supervisor");

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

          {/* Sign-off status */}
          <View style={[s.signoffBox, approved ? s.signoffApproved : s.signoffDraft]}>
            {approved ? (
              <SealCheck size={22} color={colors.onSuccess} weight="fill" />
            ) : (
              <Clock size={22} color={colors.onWarning} weight="fill" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[s.signoffTitle, { color: approved ? colors.onSuccess : colors.onWarning }]}>
                {approved ? "APPROVED & FINALISED" : "DRAFT — PENDING SIGN-OFF"}
              </Text>
              <Text style={[s.signoffMeta, { color: approved ? colors.onSuccess : colors.onWarning }]}>
                {approved
                  ? `${a.approved_by} (${a.approved_by_role}) · ${new Date(a.approved_at).toLocaleString("en-AU")}`
                  : "A Safety Officer or Supervisor must review before use"}
              </Text>
            </View>
          </View>
          {canApprove ? (
            <Pressable style={s.approveBtn} onPress={() => approve.mutate()} disabled={approve.isPending} testID="approve-assessment">
              {approve.isPending ? (
                <ActivityIndicator color={colors.onSuccess} />
              ) : (
                <>
                  <SealCheck size={20} color={colors.onSuccess} weight="bold" />
                  <Text style={s.approveText}>APPROVE & FINALISE</Text>
                </>
              )}
            </Pressable>
          ) : null}

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
              {/* Outcome banner */}
              {(() => {
                const outcome = (a.equipment_outcome || r.machinery.outcome || "").toUpperCase();
                if (outcome === "PASS" || outcome === "HAZARD") {
                  const pass = outcome === "PASS";
                  return (
                    <View style={[s.outcomeBox, pass ? s.outcomePass : s.outcomeHazard]}>
                      {pass ? <SealCheck size={24} color={colors.onSuccess} weight="fill" /> : <WarningOctagon size={24} color={colors.onError} weight="fill" />}
                      <View style={{ flex: 1 }}>
                        <Text style={[s.outcomeTitle, { color: pass ? colors.onSuccess : colors.onError }]}>
                          {pass ? "PASS — SAFE TO OPERATE" : "HAZARD — DO NOT OPERATE"}
                        </Text>
                        <Text style={[s.outcomeSub, { color: pass ? colors.onSuccess : colors.onError }]}>
                          {pass ? "Within manufacturer & safety spec" : "Out of safety spec — rectify before use"}
                        </Text>
                      </View>
                    </View>
                  );
                }
                return null;
              })()}

              {/* Equipment identification */}
              <View style={s.sectionHead}><SectionLabel>Equipment Identified</SectionLabel></View>
              <View style={s.infoCard}>
                <View style={s.equipTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.equipName}>{[r.machinery.brand, r.machinery.model].filter((x: string) => x && x !== "Unknown").join(" ") || r.machinery.machine_type || "Unidentified"}</Text>
                    <Text style={s.equipType}>{r.machinery.machine_type}</Text>
                  </View>
                  {r.machinery.identification_confidence ? (
                    <View style={s.confBadge}><Text style={s.confText}>{String(r.machinery.identification_confidence).toUpperCase()} CONF.</Text></View>
                  ) : null}
                </View>
                {r.machinery.identifiers ? <Text style={s.infoLine}><Text style={s.swmsKey}>PLATE/SERIAL: </Text>{r.machinery.identifiers}</Text> : null}
                {r.machinery.manual_reference ? <Text style={s.infoLine}><Text style={s.swmsKey}>MANUAL / STANDARD: </Text>{r.machinery.manual_reference}</Text> : null}
                <Text style={s.infoLine}><Text style={s.swmsKey}>GUARDING: </Text>{r.machinery.guarding_status}</Text>
                <Text style={s.infoLine}><Text style={s.swmsKey}>ISOLATION: </Text>{r.machinery.isolation_note}</Text>
                {r.machinery.compliance_note ? <Text style={s.infoLine}><Text style={s.swmsKey}>COMPLIANCE: </Text>{r.machinery.compliance_note}</Text> : null}
              </View>

              {/* Spec cross-reference */}
              {(r.machinery.spec_checks || []).length > 0 && (
                <>
                  <View style={s.sectionHead}><SectionLabel>Spec Cross-Reference</SectionLabel></View>
                  {r.machinery.spec_checks.map((c: any, i: number) => {
                    const pass = String(c.status).toLowerCase() === "pass";
                    return (
                      <View key={i} style={s.specCard} testID={`spec-${i}`}>
                        <View style={s.specTop}>
                          <Text style={s.specItem}>{c.item}</Text>
                          <StatusBadge label={pass ? "PASS" : "FAIL"} bg={pass ? colors.success : colors.error} fg={pass ? colors.onSuccess : colors.onError} />
                        </View>
                        <Text style={s.infoLine}><Text style={s.swmsKey}>REQUIRED: </Text>{c.requirement}</Text>
                        <Text style={s.infoLine}><Text style={s.swmsKey}>OBSERVED: </Text>{c.observed}</Text>
                        {c.reference ? <Text style={s.specRef}>{c.reference}</Text> : null}
                      </View>
                    );
                  })}
                </>
              )}

              {/* Warranty / insurance */}
              {r.machinery.warranty_insurance_note ? (
                <>
                  <View style={s.sectionHead}><SectionLabel>Warranty & Insurance</SectionLabel></View>
                  <View style={s.warrantyCard}>
                    <Text style={s.warrantyText}>{r.machinery.warranty_insurance_note}</Text>
                  </View>
                </>
              ) : null}

              {/* Auto hazard report link */}
              {a.hazard_incident_id ? (
                <Pressable style={s.hazardLink} onPress={() => router.push("/incidents" as any)} testID="view-hazard-report">
                  <WarningOctagon size={20} color={colors.onError} weight="fill" />
                  <Text style={s.hazardLinkText}>HAZARD REPORT GENERATED — VIEW & SEND</Text>
                </Pressable>
              ) : null}
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
  signoffBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginTop: 16 },
  signoffApproved: { backgroundColor: c.success },
  signoffDraft: { backgroundColor: c.warning },
  signoffTitle: { fontFamily: fonts.monoBold, fontSize: 13, letterSpacing: 1 },
  signoffMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2, opacity: 0.9 },
  approveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 52, marginTop: 12, backgroundColor: c.brandPrimary, borderWidth: 2, borderColor: c.success },
  approveText: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSuccess, letterSpacing: 0.5 },
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
  outcomeBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginTop: 16 },
  outcomePass: { backgroundColor: c.success },
  outcomeHazard: { backgroundColor: c.error },
  outcomeTitle: { fontFamily: fonts.monoBold, fontSize: 14, letterSpacing: 1 },
  outcomeSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 2, opacity: 0.9 },
  equipTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  equipName: { fontFamily: fonts.display, fontSize: 18, color: c.onSurface },
  equipType: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 1 },
  confBadge: { backgroundColor: c.surfaceInverse, paddingHorizontal: 8, paddingVertical: 4 },
  confText: { fontFamily: fonts.monoBold, fontSize: 10, color: c.onSurfaceInverse, letterSpacing: 0.5 },
  specCard: { borderWidth: 2, borderColor: c.borderStrong, padding: 14, marginBottom: 12, gap: 4 },
  specTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  specItem: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: c.onSurface },
  specRef: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: 4 },
  warrantyCard: { backgroundColor: c.warning, padding: 14 },
  warrantyText: { fontFamily: fonts.bodyMed, fontSize: 13, color: c.onWarning, lineHeight: 20 },
  hazardLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: c.error, paddingVertical: 16, marginTop: 20 },
  hazardLinkText: { fontFamily: fonts.monoBold, fontSize: 13, color: c.onError, letterSpacing: 1 },
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
