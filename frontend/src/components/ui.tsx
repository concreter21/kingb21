import React from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  TextInputProps,
  ViewStyle,
  StyleProp,
} from "react-native";
import { makeStyles, fonts, useTheme, riskColors } from "@/src/theme";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger";
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
};

export function Button({ title, onPress, variant = "primary", loading, disabled, testID, style, icon }: BtnProps) {
  const s = useBtnStyles();
  const { colors } = useTheme();
  const map: any = {
    primary: [s.base, s.primary],
    secondary: [s.base, s.secondary],
    outline: [s.base, s.outline],
    danger: [s.base, s.danger],
  };
  const textMap: any = {
    primary: s.textPrimary,
    secondary: s.textSecondary,
    outline: s.textOutline,
    danger: s.textPrimary,
  };
  const spinnerColor = variant === "outline" ? colors.onSurface : colors.onBrandPrimary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [map[variant], (disabled || loading) && s.disabled, pressed && s.pressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View style={s.row}>
          {icon}
          <Text style={[s.text, textMap[variant]]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useBtnStyles = makeStyles((c) => ({
  base: {
    minHeight: 52,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: c.borderStrong,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  primary: { backgroundColor: c.brandPrimary },
  secondary: { backgroundColor: c.surface },
  outline: { backgroundColor: c.surface, borderColor: c.borderStrong },
  danger: { backgroundColor: c.error, borderColor: c.error },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  text: { fontFamily: fonts.bodySemi, fontSize: 15, letterSpacing: 0.5 },
  textPrimary: { color: c.onBrandPrimary },
  textSecondary: { color: c.onSurface },
  textOutline: { color: c.onSurface },
}));

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
type InputProps = TextInputProps & { label?: string };
export function Input({ label, style, ...props }: InputProps) {
  const s = useInputStyles();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[s.input, style]}
        {...props}
      />
    </View>
  );
}
const useInputStyles = makeStyles((c) => ({
  label: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, letterSpacing: 1, textTransform: "uppercase" },
  input: {
    borderWidth: 2,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: 15,
    color: c.onSurface,
  },
}));

// ---------------------------------------------------------------------------
// Badge (risk / status)
// ---------------------------------------------------------------------------
export function RiskBadge({ level, testID }: { level: string; testID?: string }) {
  const { colors } = useTheme();
  const rc = riskColors(level, colors);
  return (
    <View testID={testID} style={{ backgroundColor: rc.bg, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: rc.fg, fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1 }}>
        {(level || "—").toUpperCase()}
      </Text>
    </View>
  );
}

export function StatusBadge({ label, bg, fg, testID }: { label: string; bg: string; fg: string; testID?: string }) {
  return (
    <View testID={testID} style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: fg, fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Section header label
// ---------------------------------------------------------------------------
export function SectionLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2, color: colors.muted, textTransform: "uppercase" }}>
      {children}
    </Text>
  );
}
