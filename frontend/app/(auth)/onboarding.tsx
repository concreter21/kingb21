import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ShieldCheck, ScanSmiley, Lock, IdentificationBadge } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const ONBOARDED_KEY = "tk_onboarded";

const FEATURES = [
  { icon: ScanSmiley, title: "AI Safety Assessor", desc: "Point your camera at any hazard, machine or device — get a full WHS assessment and PDF in seconds." },
  { icon: Lock, title: "LOTO & Equipment", desc: "Manage lockout/tagout and a live register of plant assessed and cleared for operation." },
  { icon: IdentificationBadge, title: "Site Access & Incidents", desc: "QR gate sign-in, visitor inductions, traffic zones and instant hazard reporting." },
];

export default function Onboarding() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const start = async () => {
    await storage.setItem(ONBOARDED_KEY, true);
    router.replace("/(auth)/login");
  };

  return (
    <View style={[s.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.top}>
        <View style={s.logoBox}>
          <ShieldCheck size={40} color={colors.onBrandPrimary} weight="fill" />
        </View>
        <Text style={s.brand}>TK SAFETYGUARD</Text>
        <Text style={s.tagline}>THE KITCHENARY · OHS&E COMMAND</Text>
      </View>

      <View style={s.features}>
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <View key={f.title} style={s.feature}>
              <View style={s.featIcon}><Icon size={24} color={colors.onSurface} weight="bold" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.featTitle}>{f.title}</Text>
                <Text style={s.featDesc}>{f.desc}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <Pressable style={s.cta} onPress={start} testID="onboarding-start">
        <Text style={s.ctaText}>GET STARTED</Text>
      </Pressable>
      <Text style={s.legal}>Aligned with the Work Health and Safety Act 2011</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface, paddingHorizontal: 24 },
  top: { alignItems: "center", gap: 10 },
  logoBox: { width: 72, height: 72, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.borderStrong },
  brand: { fontFamily: fonts.display, fontSize: 28, color: c.onSurface, marginTop: 8, letterSpacing: -0.5 },
  tagline: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, letterSpacing: 2 },
  features: { flex: 1, justifyContent: "center", gap: 20 },
  feature: { flexDirection: "row", gap: 16, alignItems: "center" },
  featIcon: { width: 52, height: 52, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  featTitle: { fontFamily: fonts.bodySemi, fontSize: 17, color: c.onSurface },
  featDesc: { fontFamily: fonts.body, fontSize: 13, color: c.muted, marginTop: 2, lineHeight: 19 },
  cta: { minHeight: 56, backgroundColor: c.brandPrimary, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: fonts.bodySemi, fontSize: 16, color: c.onBrandPrimary, letterSpacing: 1 },
  legal: { fontFamily: fonts.mono, fontSize: 10, color: c.muted, textAlign: "center", marginTop: 14, letterSpacing: 0.5 },
}));
