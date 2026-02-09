import type { PropsWithChildren } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View } from "react-native";

const baseClasses =
  "flex-1 bg-brand-light-background dark:bg-brand-background";
const contentClasses =
  "flex-1 rounded-[28px] border-2 border-brand-surface/65 bg-brand-light-background/95 px-4 py-3 dark:border-brand-surface dark:bg-brand-background/92";

interface ScreenWrapperProps extends PropsWithChildren {
  className?: string;
  contentClassName?: string;
}

export function ScreenWrapper({
  children,
  className,
  contentClassName,
}: ScreenWrapperProps) {
  return (
    <SafeAreaView className={`${baseClasses} ${className ?? ""}`.trim()}>
      <View className="absolute inset-0">
        <View className="absolute -right-12 -top-10 h-52 w-52 rounded-full bg-brand-primary/10" />
        <View className="absolute -left-10 top-28 h-32 w-32 rounded-full bg-brand-primary/8" />
      </View>
      <View className={`${contentClasses} ${contentClassName ?? ""}`.trim()}>
        {children}
      </View>
    </SafeAreaView>
  );
}
