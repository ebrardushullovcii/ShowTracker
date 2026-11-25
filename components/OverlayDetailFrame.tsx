import type { PropsWithChildren } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { TallDialog } from "@/components/DialogBackdrop";
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
  const isDesktop = Platform.OS === "web" && width >= DESKTOP_SIDEBAR_BREAKPOINT;

  // UIKit owns the backdrop, safe-area positioning and interactive dismissal.
  // Nesting TallDialog here would put a second drawer inside the native sheet.
  if (Platform.OS === "ios") {
    return (
      <View className="flex-1 bg-bg-base" accessibilityViewIsModal onAccessibilityEscape={onClose}>
        <OverlayHeader title="Details" onClose={onClose} closeAccessibilityLabel={closeAccessibilityLabel} />
        <View className="min-h-0 flex-1">{children}</View>
      </View>
    );
  }

  return (
    <TallDialog onClose={onClose} alignEnd={isDesktop} maxWidth={1024}>
      {!isDesktop ? (
        <OverlayHeader title="Details" onClose={onClose} closeAccessibilityLabel={closeAccessibilityLabel} />
      ) : null}
      <View className="min-h-0 flex-1">{children}</View>
    </TallDialog>
  );
}
