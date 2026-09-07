// Design tokens for TK SafetyGuard — The Kitchenary brand (deep teal + orange).
// Palette taken from thekitchenary.com.au: teal #0A4344, orange #E57C23, white.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

// Single brand palette applied to both schemes so the look matches the
// website consistently on every device (dark teal surfaces, orange accents).
const brand = {
  surface: "#0A4344",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#0E4F50",
  onSurfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#12595A",
  onSurfaceTertiary: "#FFFFFF",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#0A4344",
  muted: "#C4D6D5",

  brand: "#E57C23",
  onBrand: "#FFFFFF",
  brandPrimary: "#E57C23",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#0E4F50",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#12595A",
  onBrandTertiary: "#FFFFFF",

  success: "#16A34A",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#0A4344",
  error: "#E5484D",
  onError: "#FFFFFF",
  critical: "#7F1D1D",
  onCritical: "#FFFFFF",
  info: "#14625F",
  onInfo: "#FFFFFF",

  border: "#1C5F60",
  borderStrong: "#FFFFFF",
  divider: "#1C5F60",
};

export type ThemeColors = typeof brand;

const light: ThemeColors = brand;
const dark: ThemeColors = brand;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export const fonts = {
  display: "Montserrat-Bold",
  displayMed: "Montserrat-Bold",
  displayReg: "Montserrat-SemiBold",
  light: "Montserrat-Medium",
  body: "Montserrat-Medium",
  bodyMed: "Montserrat-SemiBold",
  bodySemi: "Montserrat-Bold",
  mono: "Montserrat-SemiBold",
  monoBold: "Montserrat-Bold",
};

// Vivid, high-legibility risk colours.
// red = high, yellow = medium, light green = low, dark red = critical/extreme.
const RISK = {
  critical: { bg: "#B91C1C", fg: "#FFFFFF" },
  high: { bg: "#EF4444", fg: "#FFFFFF" },
  medium: { bg: "#FACC15", fg: "#3A2E00" },
  low: { bg: "#4ADE80", fg: "#05291B" },
  none: { bg: "#86EFAC", fg: "#05291B" },
  unknown: { bg: "#14625F", fg: "#FFFFFF" },
};

// risk level -> {bg, fg}. Handles words (high/medium/low/critical), synonyms
// (extreme/moderate/negligible) and matrix codes (H12, M8, L3, E20).
export function riskColors(level: string, _c?: ThemeColors) {
  const v = (level || "").toLowerCase().trim();
  if (!v || v === "—") return RISK.unknown;
  if (v.includes("crit") || v.includes("extreme") || v.startsWith("e")) return RISK.critical;
  if (v.includes("very high") || v.includes("severe")) return RISK.critical;
  if (v.includes("high") || v.startsWith("h")) return RISK.high;
  if (v.includes("negligible") || v.includes("very low")) return RISK.none;
  if (v.includes("moderate") || v.includes("med") || v.startsWith("m")) return RISK.medium;
  if (v.includes("low") || v.startsWith("l")) return RISK.low;
  return RISK.unknown;
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
