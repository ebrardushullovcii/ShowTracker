import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import { Platform } from "react-native";
import { api } from "@/convex/_generated/api";
import { AccountApprovalScreen } from "./AccountApprovalScreen";

export function AuthGate({ children }: PropsWithChildren) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const pathname = usePathname();
  const router = useRouter();
  const access = useQuery(api.access.current, isAuthenticated ? {} : "skip");
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isLandingRoute = pathname === "/" || pathname === "/lp" || pathname === "/lp/landing";
  const isShareRoute = pathname.startsWith("/share/");
  const isPublicRoute = isAuthRoute || isShareRoute || pathname === "/admin" || (Platform.OS === "web" && isLandingRoute);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const isNative = Platform.OS !== "web";

    const unauthenticatedRedirect = isNative ? "/login" : "/";

    if (!isAuthenticated && !isPublicRoute) {
      router.replace(unauthenticatedRedirect);
      return;
    }

    if (isNative && isAuthenticated && isLandingRoute) {
      router.replace("/home");
      return;
    }

    if (isAuthenticated && isAuthRoute) {
      router.replace("/home");
    }
  }, [isAuthenticated, isLoading, isAuthRoute, isLandingRoute, isPublicRoute, router]);

  if (isLoading || (!isAuthenticated && !isPublicRoute) || (isAuthenticated && access === undefined && !isShareRoute)) {
    return <></>;
  }

  // Do not mount the app's data hooks until access has been checked.
  if (isAuthenticated && !isShareRoute && (!access || access.status === "pending")) {
    return <AccountApprovalScreen email={access?.email} unavailable={!access} />;
  }

  return <>{children}</>;
}
