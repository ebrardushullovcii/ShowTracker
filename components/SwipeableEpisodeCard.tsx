import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { EpisodeCard } from "@/components/EpisodeCard";

type EpisodeAvailability = {
  isReleased: boolean;
  dateLabel: string;
  stateLabel: string;
  stateClassName: string;
};

type SwipeableEpisodeCardProps = {
  id: string;
  episodeNumber: number;
  seasonNumber: number;
  name?: string;
  overview?: string;
  stillUrl?: string;
  airDate?: string;
  runtime?: number;
  watched: boolean;
  isUpdating: boolean;
  availability: EpisodeAvailability;
  onToggle: () => void;
  onSwipeAction?: (action: "watch" | "unwatch" | "rewatch") => void;
  watchCount?: number;
};

const ACTION_WIDTH = 96;

function hasWebTouchInput() {
  if (Platform.OS !== "web") {
    return false;
  }

  if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) {
    return true;
  }

  return typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
}

function SwipeAction({
  label,
  icon,
  tone,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "success" | "warning";
  onPress: () => void;
}) {
  const color = tone === "success" ? "#34d399" : "#fbbf24";
  const backgroundClassName =
    tone === "success"
      ? "border-emerald-400/30 bg-emerald-500/15"
      : "border-amber-300/30 bg-amber-400/15";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`mx-1 h-full items-center justify-center rounded-xl border active:scale-95 ${backgroundClassName}`}
      style={{ width: ACTION_WIDTH - 8 }}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text className="mt-1 text-[11px] font-black uppercase tracking-wide" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SwipeableEpisodeCard({
  watched,
  isUpdating,
  availability,
  onToggle,
  onSwipeAction,
  watchCount,
  ...episodeProps
}: SwipeableEpisodeCardProps) {
  const { width } = useWindowDimensions();
  const canToggle = availability.isReleased || watched;
  const isMobileWebTouch = Platform.OS === "web" && width < 1024 && hasWebTouchInput();
  const canSwipe = (Platform.OS !== "web" || isMobileWebTouch) && canToggle && !isUpdating;

  const card = (
    <EpisodeCard
      {...episodeProps}
      watched={watched}
      isUpdating={isUpdating}
      availability={availability}
      onToggle={onToggle}
      watchCount={watchCount}
    />
  );

  if (!canSwipe) {
    return card;
  }

  const rightAction = watched ? "rewatch" : "watch";
  const rightActionLabel = watched ? "Rewatch" : "Watch";

  const handleActionPress = (
    swipeable: SwipeableMethods,
    action: "watch" | "unwatch" | "rewatch"
  ) => {
    swipeable.close();
    if (onSwipeAction) {
      onSwipeAction(action);
      return;
    }
    onToggle();
  };

  return (
    <View className="overflow-hidden rounded-xl">
      <ReanimatedSwipeable
        friction={2}
        leftThreshold={ACTION_WIDTH}
        rightThreshold={ACTION_WIDTH}
        dragOffsetFromLeftEdge={16}
        dragOffsetFromRightEdge={16}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={
          watched
            ? (_progress, _translation, swipeable) => (
                <View className="h-full flex-row items-stretch justify-start">
                  <SwipeAction
                    label="Unwatch"
                    icon="remove-circle"
                    tone="warning"
                    onPress={() => handleActionPress(swipeable, "unwatch")}
                  />
                </View>
              )
            : undefined
        }
        renderRightActions={(_progress, _translation, swipeable) => (
          <View className="h-full flex-row items-stretch justify-end">
            <SwipeAction
              label={rightActionLabel}
              icon={watched ? "refresh-circle" : "checkmark-circle"}
              tone="success"
              onPress={() => handleActionPress(swipeable, rightAction)}
            />
          </View>
        )}
      >
        {card}
      </ReanimatedSwipeable>
    </View>
  );
}
