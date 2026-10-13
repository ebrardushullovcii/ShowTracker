import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text } from "react-native";

export function ShareButton({ onPress, disabled = false, label = "Share" }: {
  onPress: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-[42px] flex-row items-center justify-center gap-2 rounded-lg border border-border-default bg-bg-surface px-3 py-2"
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.75 : 1 })}>
      <Ionicons name="share-outline" size={17} color="#ef4444" />
      <Text className="text-sm font-semibold text-text-primary">{label}</Text>
    </Pressable>
  );
}
