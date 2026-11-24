import type { ComponentProps, ReactElement } from "react";
import type { Pressable } from "react-native";

export type PosterQuickActionsProps = {
  children: ReactElement<Pick<ComponentProps<typeof Pressable>, "onLongPress" | "accessibilityActions" | "onAccessibilityAction">>;
  routeId: string;
  tracked?: boolean;
};

export function PosterQuickActions({ children }: PosterQuickActionsProps) {
  return children;
}
