import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

interface PageIntroProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  rightLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
  compact?: boolean;
}

export function PageIntro({
  title,
  subtitle,
  eyebrow,
  rightLabel,
  icon,
  className,
  compact = false,
}: PageIntroProps) {
  return (
    <View
      className={`relative overflow-hidden rounded-xl border border-border-bright bg-bg-surface ${className ?? ""}`.trim()}
    >
      <LinearGradient
        colors={["rgba(239,68,68,0.14)", "rgba(56,189,248,0.07)", "rgba(24,24,27,0.72)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <View className="absolute right-0 top-0 h-full w-20 bg-primary/10" style={{ transform: [{ skewX: "-18deg" }, { translateX: 28 }] }} />
      <View className="absolute bottom-0 left-0 h-1 w-28 bg-primary/70" />

      <View className={`relative px-4 ${compact ? "py-3" : "py-4"}`}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            {eyebrow || icon ? (
              <View className={`${compact ? "mb-1.5" : "mb-2"} flex-row items-center gap-2`}>
                {icon ? (
                  <View className={`${compact ? "h-6 w-6" : "h-7 w-7"} items-center justify-center rounded-lg bg-bg-base/45`}>
                    <Ionicons name={icon} size={compact ? 13 : 14} color="#ef4444" />
                  </View>
                ) : null}
                {eyebrow ? (
                  <Text className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    {eyebrow}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Text className={`font-mono ${compact ? "text-[25px]" : "text-[30px]"} font-black text-text-primary`}>
              {title}
            </Text>
            <Text className={`${compact ? "mt-0.5 text-xs" : "mt-1 text-sm"} text-text-secondary`}>
              {subtitle}
            </Text>
          </View>

          {rightLabel ? (
            <View className="rounded-md border border-border-default bg-bg-base/55 px-2 py-1">
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                {rightLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
