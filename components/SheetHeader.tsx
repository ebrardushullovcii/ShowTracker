import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSheetDismiss } from "@/components/Sheet";

type SheetHeaderProps = {
  title: string;
  /** Short context shown next to (or under) the title. */
  detail?: string;
  /** Inline secondary text sits beside the title; stacked sits underneath. */
  detailPlacement?: "inline" | "stacked";
  actionLabel?: string;
  onAction?: () => void;
  /** Shows a close button on the title row. Inside a drawer it animates the drawer away first. */
  onClose?: () => void;
  closeLabel?: string;
  /** Extra content under the title row, such as a search field. */
  children?: ReactNode;
};

/** One-row title for drawers, so they spend little height on chrome above their content. */
export function SheetHeader({
  title,
  detail,
  detailPlacement = "inline",
  actionLabel,
  onAction,
  onClose,
  closeLabel = "Close",
  children,
}: SheetHeaderProps) {
  const dismiss = useSheetDismiss(onClose ?? noop);
  return (
    <View className="gap-3 border-b border-border-default px-dialog-gutter pb-3 pt-1">
      <View className="flex-row items-center gap-3">
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
        {onClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={dismiss}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
          >
            <Ionicons name="close" size={18} color="#e4e4e7" />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function noop() {}
