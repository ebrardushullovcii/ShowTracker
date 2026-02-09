import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useColorScheme } from "nativewind";
import { Button } from "@/components/Button";
import { ScreenWrapper } from "@/components/ScreenWrapper";

export default function ProfileScreen() {
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
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
        <View className="mb-5 rounded-[28px] border-2 border-brand-surface bg-brand-light-surface px-5 py-4 dark:bg-brand-surface/80">
          <Text className="font-serif text-3xl font-bold leading-9 text-brand-light-text dark:text-brand-text">
            Profile
          </Text>
          <Text className="mt-1 text-sm leading-6 text-[#5d4b33] dark:text-[#ebdabc]">
            Account and appearance
          </Text>
        </View>

        <View className="mb-4 rounded-2xl border-2 border-brand-surface/65 bg-brand-light-surface px-4 py-4 dark:bg-brand-surface/75">
          <Text className="font-serif text-xl font-semibold text-brand-light-text dark:text-brand-text">
            Appearance
          </Text>
          <Text className="mt-1 text-sm leading-6 text-[#5d4b33] dark:text-[#ebdabc]">
            Pick a theme. Changes apply immediately.
          </Text>

          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() => setColorScheme("light")}
              className={`flex-1 items-center rounded-xl border-2 px-3 py-2 ${
                colorScheme === "light"
                  ? "border-brand-primary bg-brand-primary"
                  : "border-brand-surface/55 bg-[#fffaf0] dark:bg-brand-background/55"
              }`}
            >
              <Text
                className={`text-xs font-bold uppercase tracking-[1.2px] ${
                  colorScheme === "light"
                    ? "text-white"
                    : "text-brand-light-text dark:text-brand-text"
                }`}
              >
                Light
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setColorScheme("dark")}
              className={`flex-1 items-center rounded-xl border-2 px-3 py-2 ${
                colorScheme === "dark"
                  ? "border-brand-primary bg-brand-primary"
                  : "border-brand-surface/55 bg-[#fffaf0] dark:bg-brand-background/55"
              }`}
            >
              <Text
                className={`text-xs font-bold uppercase tracking-[1.2px] ${
                  colorScheme === "dark"
                    ? "text-white"
                    : "text-brand-light-text dark:text-brand-text"
                }`}
              >
                Dark
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="mb-4 rounded-2xl border-2 border-brand-surface/65 bg-brand-light-surface px-4 py-4 dark:bg-brand-surface/75">
          <Text className="font-serif text-xl font-semibold text-brand-light-text dark:text-brand-text">
            Current Status
          </Text>
          <Text className="mt-1 text-sm leading-6 text-[#5d4b33] dark:text-[#ebdabc]">
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
