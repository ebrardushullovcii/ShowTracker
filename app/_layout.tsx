import "@/global.css";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClearWatchlistWidget } from "@/components/WatchlistWidgetSnapshot";
import { LogBox, Platform, View, useWindowDimensions } from "react-native";
import { ConvexAuthProvider, useAuthToken } from "@convex-dev/auth/react";
import { useEffect, type PropsWithChildren } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { SignOutProvider, useSignOut } from "@/components/SignOutProvider";
import { AuthGate } from "@/components/AuthGate";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Sidebar } from "@/components/Sidebar";
import { WatchlistPushProvider } from "@/components/WatchlistPush";
import { DESKTOP_SIDEBAR_BREAKPOINT } from "@/constants/navigation";
import { convex } from "@/lib/convex/client";
import { tokenStorage } from "@/lib/auth/token-storage";
import { setProviderAccessToken } from "@/lib/api/auth-token";
import { api } from "@/convex/_generated/api";

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated and will be removed in a future release.",
]);

function renderGatedScreen({ children }: PropsWithChildren) {
  return <AuthGate>{children}</AuthGate>;
}

const SHELL_PATHS = new Set([
  "/home",
  "/discover",
  "/recommendations",
  "/search",
  "/library",
  "/profile",
  "/profile/settings",
  "/import",
]);

function RootLayoutContent() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isSigningOut } = useSignOut();
  const access = useQuery(api.access.current, isAuthenticated && !isSigningOut ? {} : "skip");
  const token = useAuthToken();
  useEffect(() => {
    setProviderAccessToken(token);
    return () => setProviderAccessToken(null);
  }, [token]);
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= DESKTOP_SIDEBAR_BREAKPOINT;
  const pathname = usePathname();
  const isShellPath =
    SHELL_PATHS.has(pathname) || pathname.startsWith("/list/") || pathname.startsWith("/show/");
  const shouldShowDesktopSidebar =
    isDesktop && isShellPath && access?.status === "approved";
  const clearWatchlistWidget =
    isSigningOut || (!isLoading && !isAuthenticated) || (access !== undefined && access?.status !== "approved");

  return (
    <View className="flex-1 flex-row" style={{ backgroundColor: "#09090b" }}>
      <ClearWatchlistWidget clear={clearWatchlistWidget} />
      {shouldShowDesktopSidebar ? <Sidebar /> : null}
      <View className="flex-1 min-w-0">
        <WatchlistPushProvider canReceive={access?.status === "approved"}>
          <AppErrorBoundary resetKey={pathname}>
            <Stack
              screenLayout={renderGatedScreen}
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                fullScreenGestureEnabled: false,
                animationMatchesGesture: Platform.OS === "ios",
                contentStyle: Platform.OS === "ios" ? { backgroundColor: "#09090b" } : undefined,
              }}
            >
              <Stack.Protected guard={!isSigningOut}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="find" />
                <Stack.Screen
                  name="show/[id]"
                  options={{
                    presentation: "transparentModal",
                    contentStyle: { backgroundColor: "transparent" },
                  }}
                />
              </Stack.Protected>
              <Stack.Screen
                name="profile/settings"
                options={{
                  presentation: "transparentModal",
                  contentStyle: { backgroundColor: "transparent" },
                }}
              />
            </Stack>
          </AppErrorBoundary>
        </WatchlistPushProvider>
      </View>
    </View>
  );
}

export function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexAuthProvider
        client={convex}
        storage={tokenStorage}
        storageNamespace={process.env.EXPO_PUBLIC_AUTH_STORAGE_NAMESPACE}
        // App currently uses password + anonymous auth only.
        // Disable auth code handling to avoid verifyCode runtime failures
        // when stale `code` params are present.
        shouldHandleCode={false}
      >
        <ThemeProvider>
          <StatusBar style="light" />
          <SignOutProvider>
            <RootLayoutContent />
          </SignOutProvider>
        </ThemeProvider>
      </ConvexAuthProvider>
    </GestureHandlerRootView>
  );
}

export default RootLayout;
