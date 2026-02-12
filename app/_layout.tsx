import "@/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox, Platform, View } from "react-native";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { AuthGate } from "@/components/AuthGate";
import { ThemeProvider } from "@/components/ThemeProvider";
import { convex } from "@/lib/convex/client";
import { tokenStorage } from "@/lib/auth/token-storage";

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated and will be removed in a future release.",
]);

export function RootLayout() {
  return (
    <ConvexAuthProvider client={convex} storage={tokenStorage}>
      <ThemeProvider>
        <AuthGate>
          <StatusBar style="light" />
          <View className="flex-1" style={{ backgroundColor: "#09090b" }}>
            <Stack
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                fullScreenGestureEnabled: Platform.OS === "ios",
                animationMatchesGesture: Platform.OS === "ios",
              }}
            />
          </View>
        </AuthGate>
      </ThemeProvider>
    </ConvexAuthProvider>
  );
}

export default RootLayout;
