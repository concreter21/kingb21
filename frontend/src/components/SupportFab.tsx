import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { Headset } from "phosphor-react-native";

import { useTheme } from "@/src/theme";

/**
 * Floating Help & Support button, shown above the tab bar on every tab
 * so staff can ask for guidance from anywhere in the app.
 */
export function SupportFab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  // The Assess tab has a full-width capture bar pinned to the bottom, so lift
  // the button above it there to avoid covering the capture/gallery controls.
  const onAssess = (pathname || "").includes("assess");
  const bottom = insets.bottom + (onAssess ? 160 : 74);

  return (
    <Pressable
      style={[
        styles.fab,
        { bottom, backgroundColor: colors.brandPrimary, borderColor: colors.borderStrong },
      ]}
      onPress={() => router.push("/support" as any)}
      testID="support-fab"
    >
      <Headset size={26} color={colors.onBrandPrimary} weight="fill" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
