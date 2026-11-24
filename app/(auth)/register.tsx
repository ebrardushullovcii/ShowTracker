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
import { useRegisterForm } from "@/components/auth/useAuthForms";

const fieldBase =
  "flex-row items-center gap-2 rounded-lg border-2 border-border-default bg-bg-base/70 px-3 py-2.5";

export function RegisterScreen() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    error,
    success,
    isPending,
    handleRegister,
    requireApproval,
  } = useRegisterForm();

  return (
    <AuthFormCard>
      <Link href="/login" asChild>
        <Pressable className="mb-3 flex-row items-center gap-1 self-start rounded-lg bg-bg-elevated/70 px-2 py-1">
          <Ionicons name="chevron-back" size={14} color="#a1a1aa" />
          <Text className="text-xs font-semibold text-text-secondary">Back to sign in</Text>
        </Pressable>
      </Link>

      <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Register
      </Text>
      <Text
        className="mt-1 text-3xl text-text-primary"
        style={{ fontFamily: "Courier New", fontWeight: "900" }}
      >
        Create your account
      </Text>
      <Text className="mt-1 text-sm text-text-secondary">
        {requireApproval ? "New accounts require approval during our limited rollout." : "Your watch history starts here."}
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
            secureTextEntry={!showPassword}
            placeholder="Password"
            placeholderTextColor="#52525b"
            className="min-h-8 min-w-0 flex-1 p-0 text-[16px] text-text-primary"
            editable={!isPending}
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

        <View className={fieldBase}>
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-bg-elevated/70">
            <Ionicons name="shield-checkmark-outline" size={16} color="#a1a1aa" />
          </View>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            placeholder="Confirm password"
            placeholderTextColor="#52525b"
            className="min-h-8 min-w-0 flex-1 p-0 text-[16px] text-text-primary"
            editable={!isPending}
          />
          <Pressable
            onPress={() => setShowConfirmPassword((prev) => !prev)}
            className="h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated/60"
          >
            <Ionicons
              name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
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
        onPress={handleRegister}
        disabled={isPending}
        className="mt-4 items-center justify-center border-2 border-primary bg-primary py-3 active:opacity-90"
      >
        {isPending ? (
          <BrandLoader compact onPrimary />
        ) : (
          <Text className="text-sm font-black uppercase tracking-wide text-white">{requireApproval ? "Request access" : "Create Account"}</Text>
        )}
      </Pressable>

      <View className="mt-4 flex-row items-center justify-center gap-1">
        <Text className="text-sm text-text-secondary">Already have an account?</Text>
        <Link href="/login" asChild>
          <Pressable>
            <Text className="text-sm font-bold text-primary">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </AuthFormCard>
  );
}

export default function RegisterRoute() {
  // Web uses the ticket page that matches the landing; native keeps this screen.
  return Platform.OS === "web" ? <AuthTicket mode="signUp" /> : <RegisterScreen />;
}
