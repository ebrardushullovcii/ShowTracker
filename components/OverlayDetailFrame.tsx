import type { PropsWithChildren } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { SheetRouteFrame } from "@/components/Sheet";
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

  // On phones the close button sits in the drawer's grabber row; the show header already names
  // the title. The desktop side panel keeps the close button that ShowHeader renders.
  return (
    <SheetRouteFrame
      onClose={onClose}
      label="Show details"
      closeLabel={isDesktop ? undefined : closeAccessibilityLabel}
      alignEnd
      maxWidth={1024}
    >
      <View className="min-h-0 flex-1">{children}</View>
    </SheetRouteFrame>
  );
}
