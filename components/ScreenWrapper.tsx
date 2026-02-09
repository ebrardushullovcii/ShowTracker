import type { PropsWithChildren } from "react";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const baseClasses =
  "flex-1 bg-brand-light-background dark:bg-brand-background";

interface ScreenWrapperProps extends PropsWithChildren {
  className?: string;
  contentClassName?: string;
}

export function ScreenWrapper({
  children,
  className,
  contentClassName,
}: ScreenWrapperProps) {
  const isWeb = Platform.OS === "web";
  const shellPaddingClass = isWeb ? "pb-2 pt-2" : "px-0 pb-0 pt-0";
  const outerRadiusClass = isWeb ? "rounded-[36px]" : "rounded-[24px]";
  const innerRadiusClass = isWeb ? "rounded-[31px]" : "rounded-[20px]";
  const contentClasses = isWeb
    ? "flex-1 rounded-[28px] border-2 border-brand-frame/45 bg-brand-light-surface/95 px-4 pb-4 pt-4 dark:border-brand-surface dark:bg-brand-background/90"
    : "flex-1 rounded-[17px] border border-brand-frame/45 bg-brand-light-surface/95 px-2.5 pb-3 pt-3 dark:border-brand-surface dark:bg-brand-background/90";
  const outerFrameStyle = isWeb
    ? { borderWidth: 3, padding: 6 }
    : { borderWidth: 2, padding: 2 };
  const innerFrameStyle = isWeb
    ? { borderWidth: 2, padding: 4 }
    : { borderWidth: 1, padding: 2 };

  return (
    <SafeAreaView className={`${baseClasses} ${className ?? ""}`.trim()}>
      <View className="absolute inset-0">
        <View className="absolute inset-0 bg-[#eadfcf] dark:bg-[#0e141f]" />
        <View className="absolute -right-20 -top-16 h-72 w-72 rounded-full bg-brand-primary/12" />
        <View className="absolute -left-16 top-28 h-48 w-48 rounded-full bg-brand-accent/12" />
      </View>

      <View
        className={`flex-1 self-center ${shellPaddingClass}`}
        style={
          isWeb
            ? { width: "100%", maxWidth: 1460, paddingHorizontal: 2 }
            : undefined
        }
      >
        <View
          className={`flex-1 ${outerRadiusClass} border-[3px] border-brand-frame/75 bg-brand-frame/80 p-1.5 dark:border-brand-frame-light/30 dark:bg-[#17202d]`}
          style={outerFrameStyle}
        >
          <View
            className={`flex-1 ${innerRadiusClass} border-2 border-brand-frame-light/70 bg-brand-light-background/95 p-1 dark:border-brand-surface/85 dark:bg-[#121b27]`}
            style={innerFrameStyle}
          >
            <View className={`${contentClasses} ${contentClassName ?? ""}`.trim()}>
              {children}
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
