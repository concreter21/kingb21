import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AuthProvider } from "@/src/auth";
import { useAppFonts } from "@/src/fonts";
import { setColorScheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    (async () => {
      const pref = await storage.getItem<string>("tk_theme", "system");
      setColorScheme(pref === "system" ? null : (pref as "light" | "dark"));
    })();
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <StatusBar style="light" />
              {fontsLoaded ? (
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0A4344" } }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                </Stack>
              ) : (
                <View style={{ flex: 1, backgroundColor: "#0A4344" }} />
              )}
            </AuthProvider>
          </QueryClientProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
