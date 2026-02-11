import { Platform, View } from "react-native";

interface ProgressBarProps {
  /** 0–1 progress value */
  progress: number;
  className?: string;
  /** Height of the bar in pixels */
  height?: number;
}

export function ProgressBar({
  progress,
  className,
  height = 4,
}: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const widthPercent = `${Math.round(clampedProgress * 100)}%`;

  return (
    <View
      className={`overflow-hidden rounded-full bg-bg-hover/50 ${className ?? ""}`.trim()}
      style={{ height }}
    >
      <View
        className="h-full rounded-full bg-primary"
        style={{
          width: widthPercent,
          ...(Platform.OS === "web"
            ? { transition: "width 0.4s ease-out" as string }
            : {}),
        }}
      />
    </View>
  );
}
