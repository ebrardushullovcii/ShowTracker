import { Text, View } from "react-native";
import { HeaderIconButton } from "@/components/HeaderIconButton";

type OverlayHeaderProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeAccessibilityLabel: string;
};

export function OverlayHeader({ title, subtitle, onClose, closeAccessibilityLabel }: OverlayHeaderProps) {
  return (
    <View className="min-h-14 shrink-0 flex-row items-center gap-3 border-b border-border-default bg-bg-base px-page-gutter py-1.5">
      <HeaderIconButton
        icon="close"
        accessibilityLabel={closeAccessibilityLabel}
        onPress={onClose}
      />
      <View className="min-w-0 flex-1">
        <Text accessibilityRole="header" className="text-lg font-black text-text-primary">
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-text-secondary" numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}
