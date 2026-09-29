import type { ComponentProps, PropsWithChildren } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenWrapperProps extends PropsWithChildren {
  className?: string;
  contentClassName?: string;
  edges?: ComponentProps<typeof SafeAreaView>["edges"];
}

export function ScreenWrapper({
  children,
  className,
  contentClassName,
  edges = ["top"],
}: ScreenWrapperProps) {
  return (
    <SafeAreaView
      className={`flex-1 bg-bg-base ${className ?? ""}`.trim()}
      edges={edges}
    >
      {/* No bottom padding: scroll content must reach the tab bar border instead of
          being clipped above it. Scroll views pad their own ends. */}
      <View className={`flex-1 px-5 pt-4 ${contentClassName ?? ""}`.trim()}>
        {children}
      </View>
    </SafeAreaView>
  );
}
