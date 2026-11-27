import { Pressable, Text, View } from "react-native";

type SheetHeaderProps = {
  title: string;
  /** Short context shown next to (or under) the title. */
  detail?: string;
  /** Inline secondary text sits beside the title; stacked sits underneath. */
  detailPlacement?: "inline" | "stacked";
  actionLabel?: string;
  onAction?: () => void;
};

/** Compact title row for drawers. Closing lives in the grabber row or the action button. */
export function SheetHeader({ title, detail, detailPlacement = "inline", actionLabel, onAction }: SheetHeaderProps) {
  return (
    <View className="flex-row items-center gap-3 border-b border-border-default px-dialog-gutter pb-3 pt-1">
      <View className={`min-w-0 flex-1 ${detailPlacement === "inline" ? "flex-row items-baseline gap-2" : ""}`}>
        <Text accessibilityRole="header" numberOfLines={1} className="shrink-0 text-lg font-black text-text-primary">
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={1} className="shrink text-sm text-text-secondary">
            {detail}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={8}
          className="min-h-9 justify-center rounded-full bg-white/10 px-4 active:bg-white/20"
        >
          <Text className="text-sm font-bold text-text-primary">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
