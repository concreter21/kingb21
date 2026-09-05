import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import { ShieldCheck } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { Button, Input } from "@/src/components/ui";
import { useAuth } from "@/src/auth";

export default function Login() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Enter your email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.logoBox}>
          <ShieldCheck size={40} color={colors.onBrandPrimary} weight="fill" />
        </View>
        <Text style={s.brand}>TK SAFETYGUARD</Text>
        <Text style={s.tagline}>THE KITCHENARY · OHS&E COMMAND</Text>

        <View style={s.divider} />

        <Text style={s.h1}>Welcome back</Text>
        <Text style={s.sub}>Log in to access safety operations</Text>

        <View style={s.form}>
          <Input
            label="Work Email"
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@thekitchenary.com.au"
          />
          <Input
            label="Password"
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          {error ? (
            <View style={s.errorBox} testID="login-error">
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}
          <Button title="LOG IN" onPress={onLogin} loading={loading} testID="login-submit-button" />
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>No account yet?</Text>
          <Link href="/(auth)/register" asChild>
            <Pressable testID="go-to-register">
              <Text style={s.link}>CREATE ONE</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  scroll: { paddingHorizontal: 24, paddingTop: 40 },
  logoBox: {
    width: 72,
    height: 72,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: c.borderStrong,
  },
  brand: { fontFamily: fonts.display, fontSize: 28, color: c.onSurface, marginTop: 16, letterSpacing: -0.5 },
  tagline: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, letterSpacing: 2, marginTop: 4 },
  divider: { height: 2, backgroundColor: c.borderStrong, marginVertical: 28 },
  h1: { fontFamily: fonts.display, fontSize: 22, color: c.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 14, color: c.muted, marginTop: 4 },
  form: { gap: 16, marginTop: 28 },
  errorBox: { backgroundColor: c.error, padding: 12 },
  errorText: { color: c.onError, fontFamily: fonts.bodyMed, fontSize: 13 },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 28, justifyContent: "center" },
  footerText: { fontFamily: fonts.body, color: c.muted, fontSize: 13 },
  link: { fontFamily: fonts.monoBold, color: c.onSurface, fontSize: 13, letterSpacing: 1, textDecorationLine: "underline" },
}));
