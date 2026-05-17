import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useMonetizationAccess } from "@/hooks/use-monetization-access";
import { SHOWTRACKER_PLUS_PRICE } from "@/lib/monetization/config";

type SubscriptionCalloutProps = {
  className?: string;
};

export function SubscriptionCallout({ className }: SubscriptionCalloutProps) {
  const { isAdFree, source } = useMonetizationAccess();

  return (
    <Link href="/subscribe" asChild>
      <Pressable
        className={`overflow-hidden rounded-xl border border-border-default bg-bg-surface ${
          className ?? ""
        }`.trim()}
      >
        <LinearGradient
          colors={
            isAdFree
              ? ["rgba(52,211,153,0.14)", "rgba(24,24,27,0.98)"]
              : ["rgba(239,68,68,0.14)", "rgba(249,115,22,0.08)", "rgba(24,24,27,0.98)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 14 }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className={`h-10 w-10 items-center justify-center rounded-lg ${
                isAdFree ? "bg-success/15" : "bg-primary/15"
              }`}
            >
              <Ionicons
                name={isAdFree ? "shield-checkmark-outline" : "sparkles-outline"}
                size={19}
                color={isAdFree ? "#34d399" : "#ef4444"}
              />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[10px] font-black uppercase tracking-[1.4px] text-text-muted">
                {isAdFree ? `Plus active${source === "preview" ? " preview" : ""}` : "ShowTracker Plus"}
              </Text>
              <Text className="text-base font-black text-text-primary" numberOfLines={1}>
                {isAdFree ? "Network ads are hidden" : `${SHOWTRACKER_PLUS_PRICE}/mo removes ads`}
              </Text>
              <Text className="mt-0.5 text-xs text-text-secondary" numberOfLines={1}>
                {isAdFree ? "Open your plan controls" : "A lightweight subscription that removes network ads"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />
          </View>
        </LinearGradient>
      </Pressable>
    </Link>
  );
}
