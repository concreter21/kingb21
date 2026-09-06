// Design tokens for TK SafetyGuard — Brutalist Mobile LIGHT.
// Keys match the "color" block of /app/design_guidelines.json.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#111111",
  surfaceSecondary: "#F4F4F5",
  onSurfaceSecondary: "#18181B",
  surfaceTertiary: "#E4E4E7",
  onSurfaceTertiary: "#27272A",
  surfaceInverse: "#111111",
  onSurfaceInverse: "#FFFFFF",
  muted: "#71717A",

  brand: "#111111",
  onBrand: "#FFFFFF",
  brandPrimary: "#111111",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#3F3F46",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#E4E4E7",
  onBrandTertiary: "#111111",

  success: "#16A34A",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#111111",
  error: "#DC2626",
  onError: "#FFFFFF",
  critical: "#7F1D1D",
  onCritical: "#FFFFFF",
  info: "#52525B",
  onInfo: "#FFFFFF",

  border: "#E4E4E7",
  borderStrong: "#111111",
  divider: "#E4E4E7",
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  surface: "#111111",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#1C1C1F",
  onSurfaceSecondary: "#E4E4E7",
  surfaceTertiary: "#27272A",
  onSurfaceTertiary: "#D4D4D8",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#111111",
  muted: "#A1A1AA",

  brand: "#FFFFFF",
  onBrand: "#111111",
  brandPrimary: "#FFFFFF",
  onBrandPrimary: "#111111",
  brandSecondary: "#3F3F46",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#27272A",
  onBrandTertiary: "#FFFFFF",

  success: "#16A34A",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#111111",
  error: "#EF4444",
  onError: "#FFFFFF",
  critical: "#7F1D1D",
  onCritical: "#FFFFFF",
  info: "#A1A1AA",
  onInfo: "#111111",

  border: "#3F3F46",
  borderStrong: "#FFFFFF",
  divider: "#27272A",
};

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export const fonts = {
  display: "SpaceGrotesk-Bold",
  displayMed: "SpaceGrotesk-Medium",
  displayReg: "SpaceGrotesk-Regular",
  body: "IBMPlexSans-Regular",
  bodyMed: "IBMPlexSans-Medium",
  bodySemi: "IBMPlexSans-SemiBold",
  mono: "IBMPlexMono-Medium",
  monoBold: "IBMPlexMono-Bold",
};

// risk level -> {bg, fg} using semantic tokens
export function riskColors(level: string, c: ThemeColors) {
  switch ((level || "").toLowerCase()) {
    case "low":
      return { bg: c.success, fg: c.onSuccess };
    case "medium":
      return { bg: c.warning, fg: c.onWarning };
    case "high":
      return { bg: c.error, fg: c.onError };
    case "critical":
      return { bg: c.critical, fg: c.onCritical };
    default:
      return { bg: c.surfaceTertiary, fg: c.onSurfaceTertiary };
  }
}

// Never pass null to the native Appearance module (crashes Expo Go on Android).
// Resolve to a concrete scheme, defaulting to the device scheme or `light`.
export function setColorScheme(scheme?: ColorScheme | null) {
  const resolved: ColorScheme =
    scheme === "light" || scheme === "dark"
      ? scheme
      : (Appearance.getColorScheme?.() === "dark" ? "dark" : defaultScheme);
  try {
    Appearance.setColorScheme?.(resolved);
  } catch {
    // ignore platforms that don't support setColorScheme
  }
}

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
