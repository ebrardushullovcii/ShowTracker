import type { PropsWithChildren, ReactNode } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DESKTOP_SIDEBAR_BREAKPOINT } from "@/constants/navigation";

/** Share of the window a tall sheet covers. The page above it stays visible so it reads as a drawer. */
export const SHEET_TALL_DETENT = 0.82;
export const SHEET_CORNER_RADIUS = 28;
/** Minimum gap between the status bar and the top of a sheet. */
const SHEET_MIN_TOP_GAP = 16;

export type SheetSize = "tall" | "auto";

export type SheetProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  /** Accessible name for the sheet. */
  label: string;
  /** "tall" fills most of the screen; "auto" fits its content up to the same height. */
  size?: SheetSize;
  /** False while a save is running so gestures and the backdrop cannot close the sheet. */
  dismissible?: boolean;
  avoidKeyboard?: boolean;
  /** Width cap for the centered desktop dialog. */
  maxWidth?: number;
  /**
   * False when the content scrolls on its own (for example a WebView): only the grabber and
   * SheetDragHandle regions then drag the sheet.
   */
  contentDraggable?: boolean;
  /** Puts a close button with this accessible name in the grabber row. */
  closeLabel?: string;
  /** Called once the sheet has fully closed. */
  onDismiss?: () => void;
}>;

export type SheetRouteFrameProps = {
  children: ReactNode;
  onClose: () => void;
  label: string;
  maxWidth?: number;
  /** Puts a close button with this accessible name in the grabber row. */
  closeLabel?: string;
  /** Desktop web only: dock the panel to the right edge. */
  alignEnd?: boolean;
};

export function useSheetMetrics() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = Math.round(
    Math.min(height - insets.top - SHEET_MIN_TOP_GAP, height * SHEET_TALL_DETENT),
  );
  return {
    width,
    height,
    insets,
    maxHeight,
    topGap: height - maxHeight,
    isDesktop: Platform.OS === "web" && width >= DESKTOP_SIDEBAR_BREAKPOINT,
  };
}
