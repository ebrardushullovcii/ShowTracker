import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/Button";
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
    <ScreenWrapper contentClassName="justify-center">
      <View className="gap-4">
        <View className="rounded-[28px] border-2 border-brand-surface bg-brand-light-surface px-5 py-5 dark:bg-brand-surface/85">
          <Text className="text-[11px] font-bold uppercase tracking-[1.8px] text-brand-primary">
            ShowTracker
          </Text>
          <Text className="mt-1 font-serif text-4xl font-bold text-brand-light-text dark:text-brand-text">
            Welcome Back
          </Text>
          <Text className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Sign in and continue your watch log from any device.
          </Text>
        </View>

        <View className="gap-3 rounded-2xl border-2 border-brand-surface/70 bg-brand-light-surface p-4 dark:bg-brand-surface/80">
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#857861"
            className="rounded-xl border-2 border-brand-surface/55 bg-[#fffaf0] px-4 py-3 text-base text-brand-light-text dark:bg-brand-background/70 dark:text-brand-text"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#857861"
            className="rounded-xl border-2 border-brand-surface/55 bg-[#fffaf0] px-4 py-3 text-base text-brand-light-text dark:bg-brand-background/70 dark:text-brand-text"
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
