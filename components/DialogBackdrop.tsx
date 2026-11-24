import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DESKTOP_SIDEBAR_BREAKPOINT } from "@/constants/navigation";

const DIALOG_MARGIN = 16;
const DRAWER_TOP_GAP = 24;

export function DialogBackdrop({
  children,
  avoidKeyboard,
}: PropsWithChildren<{ avoidKeyboard?: boolean }>) {
  const insets = useSafeAreaInsets();
  const frame = (
    <View
      className="flex-1 items-center justify-center bg-black/70"
      style={{
        paddingTop: insets.top + DIALOG_MARGIN,
        paddingRight: insets.right + DIALOG_MARGIN,
        paddingBottom: insets.bottom + DIALOG_MARGIN,
        paddingLeft: insets.left + DIALOG_MARGIN,
      }}
    >
      {children}
    </View>
  );

  return avoidKeyboard ? (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {frame}
    </KeyboardAvoidingView>
  ) : frame;
}

export function TallDialog({
  children,
  onClose,
  maxWidth = 1180,
  alignEnd,
}: PropsWithChildren<{ onClose: () => void; maxWidth?: number; alignEnd?: boolean }>) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDrawer = width < DESKTOP_SIDEBAR_BREAKPOINT;
  return (
    <View
      className="flex-1 bg-black/70"
      style={{
        alignItems: alignEnd && !isDrawer ? "flex-end" : "center",
        paddingTop: insets.top + (isDrawer ? DRAWER_TOP_GAP : DIALOG_MARGIN),
        paddingRight: isDrawer ? 0 : insets.right + DIALOG_MARGIN,
        paddingBottom: isDrawer ? 0 : insets.bottom + DIALOG_MARGIN,
        paddingLeft: isDrawer ? 0 : insets.left + DIALOG_MARGIN,
      }}
    >
      <Pressable className="absolute inset-0" accessible={false} focusable={false} onPress={onClose} />
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        className={isDrawer
          ? "w-full flex-1 overflow-hidden rounded-t-[32px] border border-b-0 border-white/10 bg-bg-base"
          : "overlay-outline w-full flex-1 bg-bg-base"}
        style={isDrawer
          ? { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: insets.bottom }
          : { maxWidth }}
      >
        {children}
      </View>
    </View>
  );
}
