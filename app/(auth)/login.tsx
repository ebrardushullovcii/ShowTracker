import { Link } from "expo-router";
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BrandLoader } from "@/components/BrandLoader";
import { AuthFormCard } from "@/components/auth/AuthFormCard";
import { AuthTicket } from "@/components/auth/AuthTicket";
import { useSignInForm } from "@/components/auth/useAuthForms";

const fieldBase =
  "flex-row items-center gap-2 rounded-lg border-2 border-border-default bg-bg-base/70 px-3 py-2.5";

export function LoginScreen() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    error,
    success,
    isPending,
    handleSignIn,
    handleAnonymousSignIn,
    guestAllowed,
  } = useSignInForm();

  return (
    <AuthFormCard>
      <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Sign in
      </Text>
      <Text
        className="mt-1 text-3xl text-text-primary"
        style={{ fontFamily: "Courier New", fontWeight: "900" }}
      >
        Welcome back
      </Text>
      <Text className="mt-1 text-sm text-text-secondary">
        Continue your watch journey.
      </Text>

      <View className="mt-5 gap-3">
        <View className={fieldBase}>
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-bg-elevated/70">
            <Ionicons name="mail-outline" size={16} color="#a1a1aa" />
          </View>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#52525b"
            className="min-h-8 min-w-0 flex-1 p-0 text-[16px] text-text-primary"
            editable={!isPending}
          />
        </View>

        <View className={fieldBase}>
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-bg-elevated/70">
            <Ionicons name="lock-closed-outline" size={16} color="#a1a1aa" />
          </View>
          <TextInput
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => {
              void handleSignIn();
            }}
            secureTextEntry={!showPassword}
            placeholder="Password"
            placeholderTextColor="#52525b"
            className="min-h-8 min-w-0 flex-1 p-0 text-[16px] text-text-primary"
            editable={!isPending}
            returnKeyType="go"
          />
          <Pressable
            onPress={() => setShowPassword((prev) => !prev)}
            className="h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated/60"
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={15}
              color="#a1a1aa"
            />
          </Pressable>
        </View>
      </View>

      {error ? (
        <View className="mt-3 flex-row items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5">
          <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
          <Text className="flex-1 text-sm text-primary">{error}</Text>
        </View>
      ) : null}

      {success ? (
        <View className="mt-3 flex-row items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5">
          <Ionicons name="checkmark-circle-outline" size={16} color="#34d399" />
          <Text className="flex-1 text-sm text-success">{success}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleSignIn}
        disabled={isPending}
        className="mt-4 items-center justify-center border-2 border-primary bg-primary py-3 active:opacity-90"
      >
        {isPending ? (
          <BrandLoader compact onPrimary />
        ) : (
          <Text className="text-sm font-black uppercase tracking-wide text-white">Sign In</Text>
        )}
      </Pressable>

      {guestAllowed && (
        <Pressable
          onPress={handleAnonymousSignIn}
          disabled={isPending}
          className="mt-2 flex-row items-center justify-center gap-2 rounded-lg border-2 border-border-bright bg-bg-elevated/70 py-3 active:opacity-90"
        >
          <Ionicons name="person-outline" size={15} color="#a1a1aa" />
          <Text className="text-sm font-semibold text-text-primary">Continue as guest</Text>
        </Pressable>
      )}

      <View className="mt-4 flex-row items-center justify-center gap-1">
        <Text className="text-sm text-text-secondary">Need an account?</Text>
        <Link href="/register" asChild>
          <Pressable>
            <Text className="text-sm font-bold text-primary">Create one</Text>
          </Pressable>
        </Link>
      </View>
    </AuthFormCard>
  );
}

export default function LoginRoute() {
  // Web uses the ticket page that matches the landing; native keeps this screen.
  return Platform.OS === "web" ? <AuthTicket mode="signIn" /> : <LoginScreen />;
}
