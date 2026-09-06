import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CaretLeft, EnvelopeSimple, LockKey } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { Button, Input } from "@/src/components/ui";
import { useAuth } from "@/src/auth";

export default function Forgot() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { forgotPassword, resetPassword } = useAuth();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    setError("");
    if (!email) { setError("Enter your work email"); return; }
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setInfo(`If an account exists for ${email.trim()}, a 6-digit code has been emailed.`);
      setStep("reset");
    } catch (e: any) {
      setError(e.message || "Could not send code");
    } finally {
      setLoading(false);
    }
  };

  const doReset = async () => {
    setError("");
    if (code.length < 6) { setError("Enter the 6-digit code"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await resetPassword(email.trim(), code.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      <Pressable style={s.back} onPress={() => router.back()} testID="forgot-back">
        <CaretLeft size={20} color={colors.onSurface} weight="bold" />
        <Text style={s.backText}>BACK</Text>
      </Pressable>
      <KeyboardAwareScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.iconBox}>
          {step === "request" ? (
            <EnvelopeSimple size={36} color={colors.onBrandPrimary} weight="fill" />
          ) : (
            <LockKey size={36} color={colors.onBrandPrimary} weight="fill" />
          )}
        </View>
        <Text style={s.h1}>{step === "request" ? "Reset password" : "Enter code"}</Text>
        <Text style={s.sub}>
          {step === "request"
            ? "We'll email you a 6-digit code to reset your password."
            : "Enter the code we emailed and choose a new password."}
        </Text>

        <View style={s.form}>
          {step === "request" ? (
            <>
              <Input
                label="Work Email"
                testID="forgot-email-input"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@thekitchenary.com.au"
              />
              {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}
              <Button title="EMAIL ME A CODE" onPress={sendCode} loading={loading} testID="forgot-send-button" />
            </>
          ) : (
            <>
              {info ? <View style={s.infoBox}><Text style={s.infoText}>{info}</Text></View> : null}
              <Input label="6-Digit Code" testID="reset-code-input" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="000000" />
              <Input label="New Password" testID="reset-password-input" value={password} onChangeText={setPassword} secureTextEntry placeholder="min 6 characters" />
              {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}
              <Button title="RESET PASSWORD" onPress={doReset} loading={loading} testID="reset-submit-button" />
              <Pressable onPress={sendCode} testID="resend-code" style={{ alignSelf: "center", paddingVertical: 4 }}>
                <Text style={s.resend}>RESEND CODE</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  back: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 24, paddingVertical: 8 },
  backText: { fontFamily: fonts.monoBold, fontSize: 12, color: c.onSurface, letterSpacing: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 24 },
  iconBox: { width: 64, height: 64, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.borderStrong },
  h1: { fontFamily: fonts.display, fontSize: 26, color: c.onSurface, marginTop: 16 },
  sub: { fontFamily: fonts.body, fontSize: 14, color: c.muted, marginTop: 4, lineHeight: 20 },
  form: { gap: 16, marginTop: 28 },
  errorBox: { backgroundColor: c.error, padding: 12 },
  errorText: { color: c.onError, fontFamily: fonts.bodyMed, fontSize: 13 },
  infoBox: { backgroundColor: c.surfaceSecondary, padding: 12, borderLeftWidth: 4, borderLeftColor: c.borderStrong },
  infoText: { color: c.onSurfaceSecondary, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  resend: { fontFamily: fonts.mono, fontSize: 12, color: c.muted, letterSpacing: 1, textDecorationLine: "underline" },
}));
