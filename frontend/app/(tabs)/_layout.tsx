import React from "react";
import { Platform, View } from "react-native";
import { Tabs } from "expo-router";
import { House, ScanSmiley, Lock, IdentificationBadge, User } from "phosphor-react-native";

import { useTheme, fonts } from "@/src/theme";
import { SupportFab } from "@/src/components/SupportFab";

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.onSurface,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 2,
            borderTopColor: colors.borderStrong,
            ...(Platform.OS === "web" ? { height: 64 } : {}),
          },
          tabBarItemStyle: { alignSelf: "center" },
          tabBarLabelStyle: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.5 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => <House size={24} color={color} weight={focused ? "fill" : "regular"} />,
          }}
        />
        <Tabs.Screen
          name="assess"
          options={{
            title: "AI Assess",
            tabBarIcon: ({ color, focused }) => <ScanSmiley size={24} color={color} weight={focused ? "fill" : "regular"} />,
          }}
        />
        <Tabs.Screen
          name="registers"
          options={{
            title: "LOTO",
            tabBarIcon: ({ color, focused }) => <Lock size={24} color={color} weight={focused ? "fill" : "regular"} />,
          }}
        />
        <Tabs.Screen
          name="access"
          options={{
            title: "Access",
            tabBarIcon: ({ color, focused }) => <IdentificationBadge size={24} color={color} weight={focused ? "fill" : "regular"} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => <User size={24} color={color} weight={focused ? "fill" : "regular"} />,
          }}
        />
      </Tabs>
      <SupportFab />
    </View>
  );
}
