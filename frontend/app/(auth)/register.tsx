import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import { CaretLeft } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { Button, Input } from "@/src/components/ui";
import { useAuth } from "@/src/auth";

const ROLES = ["Worker", "Supervisor", "Safety Officer", "Contractor"];

export default function Register() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Worker");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    setError("");
    if (!email || !password || !name) {
      setError("Fill in your name, email and password");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim(), role);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      <Pressable style={s.back} onPress={() => router.back()} testID="register-back">
        <CaretLeft size={20} color={colors.onSurface} weight="bold" />
        <Text style={s.backText}>BACK</Text>
      </Pressable>
      <KeyboardAwareScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.h1}>Create account</Text>
        <Text style={s.sub}>Register for site safety access</Text>

        <View style={s.form}>
          <Input label="Full Name" testID="register-name-input" value={name} onChangeText={setName} placeholder="Jordan Smith" />
          <Input
            label="Work Email"
            testID="register-email-input"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@thekitchenary.com.au"
          />
          <Input label="Password" testID="register-password-input" value={password} onChangeText={setPassword} secureTextEntry placeholder="min 6 characters" />

          <View style={{ gap: 8 }}>
            <Text style={s.label}>ROLE</Text>
            <View style={s.roleRow}>
              {ROLES.map((r) => {
                const active = role === r;
                return (
                  <Pressable
                    key={r}
                    testID={`role-${r}`}
                    onPress={() => setRole(r)}
                    style={[s.roleChip, active && s.roleChipActive]}
                  >
                    <Text style={[s.roleText, active && s.roleTextActive]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {error ? (
            <View style={s.errorBox} testID="register-error">
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}
          <Button title="CREATE ACCOUNT" onPress={onRegister} loading={loading} testID="register-submit-button" />
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Already registered?</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable testID="go-to-login">
              <Text style={s.link}>LOG IN</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  back: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 24, paddingVertical: 8 },
  backText: { fontFamily: fonts.monoBold, fontSize: 12, color: c.onSurface, letterSpacing: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16 },
  h1: { fontFamily: fonts.display, fontSize: 26, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 14, color: c.muted, marginTop: 4 },
  form: { gap: 16, marginTop: 24 },
  label: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, letterSpacing: 1 },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: { borderWidth: 2, borderColor: c.borderStrong, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.surface },
  roleChipActive: { backgroundColor: c.brandPrimary },
  roleText: { fontFamily: fonts.bodyMed, fontSize: 13, color: c.onSurface },
  roleTextActive: { color: c.onBrandPrimary },
  errorBox: { backgroundColor: c.error, padding: 12 },
  errorText: { color: c.onError, fontFamily: fonts.bodyMed, fontSize: 13 },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 28, justifyContent: "center" },
  footerText: { fontFamily: fonts.body, color: c.muted, fontSize: 13 },
  link: { fontFamily: fonts.monoBold, color: c.onSurface, fontSize: 13, letterSpacing: 1, textDecorationLine: "underline" },
}));
