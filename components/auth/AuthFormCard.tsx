import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CardTopGlow } from "@/components/CardTopGlow";

// Used by the native sign-in and registration routes.
export function AuthFormCard({ children }: PropsWithChildren) {
  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="relative flex-1 overflow-hidden bg-bg-base">
        <LinearGradient
          colors={["#09090b", "#120d0d", "#09090b"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View className="absolute -left-20 -top-12 h-56 w-56 rounded-full bg-primary/20" />
        <View className="absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-accent/10" />

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="grow items-center justify-center px-page-gutter py-6"
          >
            <View className="w-full max-w-md overflow-hidden rounded-xl border-2 border-border-default bg-bg-surface p-page-gutter">
              <CardTopGlow />
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
