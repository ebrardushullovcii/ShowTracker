import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/Button";
import { PageBackButton } from "@/components/PageBackButton";
import { ScreenWrapper } from "@/components/ScreenWrapper";

export default function LoginScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      const result = await signIn("password", {
        flow: "signIn",
        email: email.trim().toLowerCase(),
        password,
      });

      if (result.signingIn) {
        router.replace("/");
        return;
      }
      setError("Invalid credentials.");
    } catch (authError) {
      console.error("Login failed", authError);
      setError(
        authError instanceof Error ? authError.message : "Failed to sign in."
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsPending(true);
    setError(null);
    try {
      const result = await signIn("anonymous");
      if (result.signingIn) {
        router.replace("/");
        return;
      }
      setError("Failed to continue as guest.");
    } catch (authError) {
      console.error("Anonymous login failed", authError);
      setError(
        authError instanceof Error
          ? authError.message
          : "Failed to continue as guest."
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <ScreenWrapper contentClassName="pt-6">
      <View className="gap-4 pt-12">
        <PageBackButton fallbackHref="/" />

        <View className="rounded-[24px] border-2 border-brand-frame/55 bg-brand-light-surface px-5 py-4 dark:border-brand-surface/75 dark:bg-brand-surface/85">
          <Text className="mt-1 font-serif text-4xl font-bold text-brand-ink dark:text-brand-text">
            Sign In
          </Text>
          <Text className="mt-1 text-sm leading-6 text-brand-ink-soft dark:text-[#e2d7c1]">
            Access your watch data
          </Text>
        </View>

        <View className="gap-3 rounded-2xl border-2 border-brand-frame/55 bg-brand-light-surface p-4 dark:border-brand-surface/75 dark:bg-brand-surface/80">
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#7a6650"
            className="rounded-xl border-2 border-brand-frame/45 bg-[#fffaf0] px-4 py-3 text-base text-brand-ink dark:border-brand-surface/70 dark:bg-brand-background/70 dark:text-brand-text"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#7a6650"
            className="rounded-xl border-2 border-brand-frame/45 bg-[#fffaf0] px-4 py-3 text-base text-brand-ink dark:border-brand-surface/70 dark:bg-brand-background/70 dark:text-brand-text"
          />
          {error ? (
            <Text className="text-sm text-red-600 dark:text-red-300">{error}</Text>
          ) : null}
          <Button
            label={isPending ? "Signing in..." : "Sign in"}
            onPress={handleSignIn}
            disabled={isPending}
          />
          <Button
            label="Continue as guest"
            className="bg-brand-surface"
            onPress={handleAnonymousSignIn}
            disabled={isPending}
          />
        </View>

        <Link
          href="/register"
          className="text-sm font-semibold uppercase tracking-[1.2px] text-brand-primary"
        >
          Need an account? Create one
        </Link>
      </View>
    </ScreenWrapper>
  );
}
