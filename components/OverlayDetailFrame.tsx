import type { PropsWithChildren } from "react";
import { Platform, Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OverlayHeader } from "@/components/OverlayHeader";
import { DESKTOP_SIDEBAR_BREAKPOINT } from "@/constants/navigation";

type OverlayDetailFrameProps = PropsWithChildren<{
  onClose: () => void;
  closeAccessibilityLabel?: string;
}>;

export function OverlayDetailFrame({
  children,
  onClose,
  closeAccessibilityLabel = "Close show details",
}: OverlayDetailFrameProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = Platform.OS === "web" && width >= DESKTOP_SIDEBAR_BREAKPOINT;

  return (
    <View className="flex-1 bg-black/65">
      {isDesktop ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeAccessibilityLabel}
          className="absolute inset-0"
          onPress={onClose}
        />
      ) : null}

      <View
        className={
          `overlay-outline bg-bg-base ${isDesktop
            ? "ml-auto h-full w-full max-w-5xl shadow-2xl"
            : "mx-1 mb-1 flex-1"}`
        }
        style={
          isDesktop
            ? { shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 36 }
            : { marginTop: insets.top + 8, paddingLeft: insets.left, paddingRight: insets.right }
        }
      >
        {isDesktop ? (
          children
        ) : (
          <>
            <OverlayHeader
              title="Details"
              onClose={onClose}
              closeAccessibilityLabel={closeAccessibilityLabel}
            />
            <View className="flex-1 overflow-hidden">{children}</View>
          </>
        )}
      </View>
    </View>
  );
}
