import { useState } from "react";
import { Text, View } from "react-native";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/Button";
import { ScreenWrapper } from "@/components/ScreenWrapper";

export default function ProfileScreen() {
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out failed", error);
      setSignOutError("Could not sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <ScreenWrapper>
      <View className="pb-10">
        <View className="mb-4 rounded-[28px] border-2 border-brand-surface bg-brand-light-surface px-5 py-5 dark:bg-brand-surface/80">
          <Text className="text-[11px] font-bold uppercase tracking-[1.8px] text-brand-primary">
            Profile
          </Text>
          <Text className="mt-1 font-serif text-3xl font-bold leading-9 text-brand-light-text dark:text-brand-text">
            Control Room
          </Text>
          <Text className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Account and app controls live here while stats are being built.
          </Text>
        </View>

        <View className="mb-4 rounded-2xl border-2 border-brand-surface/65 bg-brand-light-surface px-4 py-4 dark:bg-brand-surface/75">
          <Text className="font-serif text-xl font-semibold text-brand-light-text dark:text-brand-text">
            Current Status
          </Text>
          <Text className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {isAuthenticated
              ? "Signed in and synced with Convex."
              : "Not authenticated."}
          </Text>
        </View>

        <Button
          label={isSigningOut ? "Signing out..." : "Sign out"}
          onPress={handleSignOut}
          disabled={!isAuthenticated || isSigningOut}
        />

        {signOutError ? (
          <Text className="mt-3 text-sm text-red-600 dark:text-red-300">
            {signOutError}
          </Text>
        ) : null}
      </View>
    </ScreenWrapper>
  );
}
