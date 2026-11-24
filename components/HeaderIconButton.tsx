import type { ComponentProps } from "react";
import { Pressable, type PressableStateCallbackType } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type HeaderIconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  className?: string;
  iconColor?: string;
  iconSize?: number;
} & Pick<ComponentProps<typeof Pressable>, "disabled">;

type WebPressableState = PressableStateCallbackType & {
  hovered?: boolean;
  focused?: boolean;
};

function getInteractiveStyle({ pressed, hovered, focused }: WebPressableState) {
  return {
    opacity: pressed ? 0.82 : 1,
    transform: [{ scale: pressed ? 0.97 : 1 }],
    ...(hovered || focused ? { borderColor: "rgba(239,68,68,0.72)" } : {}),
  };
}

export function HeaderIconButton({
  icon,
  accessibilityLabel,
  onPress,
  className,
  iconColor = "#f4f4f5",
  iconSize = 21,
  disabled,
}: HeaderIconButtonProps) {
  const background = icon === "close" ? "bg-transparent" : "bg-bg-base/80";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={`h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 ${background} ${className ?? ""}`.trim()}
      style={getInteractiveStyle}
    >
      <Ionicons name={icon} size={iconSize} color={iconColor} />
    </Pressable>
  );
}
