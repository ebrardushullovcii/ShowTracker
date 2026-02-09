import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { Platform, View, useWindowDimensions } from "react-native";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { AuthGate } from "@/components/AuthGate";
import { DesktopRemoteDock } from "@/components/DesktopRemoteDock";
import { ThemeProvider } from "@/components/ThemeProvider";
import {
  DESKTOP_TAB_RAIL_BREAKPOINT,
  DESKTOP_TAB_RAIL_GAP,
  DESKTOP_TAB_RAIL_WIDTH,
} from "@/constants/navigation";
import { convex } from "@/lib/convex/client";
import { tokenStorage } from "@/lib/auth/token-storage";

export function RootLayout() {
  const { colorScheme } = useColorScheme();
  const { width } = useWindowDimensions();
  const isDark = colorScheme === "dark";
  const isDesktopRemote =
    Platform.OS === "web" && width >= DESKTOP_TAB_RAIL_BREAKPOINT;
  const desktopInset = isDesktopRemote
    ? DESKTOP_TAB_RAIL_WIDTH + DESKTOP_TAB_RAIL_GAP
    : 0;

  return (
    <ConvexAuthProvider client={convex} storage={tokenStorage}>
      <ThemeProvider>
        <AuthGate>
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
          <View className="flex-1" style={{ paddingLeft: desktopInset, backgroundColor: isDark ? "#0f141d" : "#e9ddca" }}>
            <Stack screenOptions={{ headerShown: false }} />
            {isDesktopRemote ? <DesktopRemoteDock /> : null}
          </View>
        </AuthGate>
      </ThemeProvider>
    </ConvexAuthProvider>
  );
}

export default RootLayout;
