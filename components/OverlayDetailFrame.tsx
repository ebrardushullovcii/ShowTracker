import type { PropsWithChildren } from "react";
import { Platform, Pressable, View, useWindowDimensions } from "react-native";
import { DESKTOP_SIDEBAR_BREAKPOINT } from "@/constants/navigation";

type OverlayDetailFrameProps = PropsWithChildren<{
  onClose: () => void;
}>;

export function OverlayDetailFrame({ children, onClose }: OverlayDetailFrameProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= DESKTOP_SIDEBAR_BREAKPOINT;

  return (
    <View className="flex-1 bg-black/65">
      {isDesktop ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close show details"
          className="absolute inset-0"
          onPress={onClose}
        />
      ) : null}

      <View
        className={
          isDesktop
            ? "ml-auto h-full w-full max-w-5xl overflow-hidden border-l-2 border-border-bright bg-bg-base shadow-2xl"
            : "mt-8 flex-1 overflow-hidden rounded-t-[28px] border-x-2 border-t-2 border-border-bright bg-bg-base shadow-2xl"
        }
        style={
          isDesktop
            ? { shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 36 }
            : { shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 28 }
        }
      >
        {children}
      </View>
    </View>
  );
}
