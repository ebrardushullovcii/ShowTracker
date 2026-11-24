import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DIALOG_MARGIN = 16;

export function DialogBackdrop({
  children,
  avoidKeyboard,
  alignEnd,
}: PropsWithChildren<{ avoidKeyboard?: boolean; alignEnd?: boolean }>) {
  const insets = useSafeAreaInsets();
  const frame = (
    <View
      className="flex-1 justify-center bg-black/70"
      style={{
        alignItems: alignEnd ? "flex-end" : "center",
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
  return (
    <DialogBackdrop alignEnd={alignEnd}>
      <Pressable className="absolute inset-0" accessible={false} focusable={false} onPress={onClose} />
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        className="overlay-outline w-full flex-1 bg-bg-base"
        style={{ maxWidth }}
      >
        {children}
      </View>
    </DialogBackdrop>
  );
}
