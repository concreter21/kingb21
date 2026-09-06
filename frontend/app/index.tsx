import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (loading) return;
    (async () => {
      if (user) {
        router.replace("/(tabs)");
        return;
      }
      const onboarded = await storage.getItem<boolean>("tk_onboarded", false);
      router.replace(onboarded ? "/(auth)/login" : "/(auth)/onboarding");
    })();
  }, [user, loading]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator color={colors.onSurface} />
    </View>
  );
}
