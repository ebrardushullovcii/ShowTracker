export type WatchlistAirtimeMode = "same_day" | "after_airtime";

export type WatchlistScheduleCounts = {
  availableCount: number;
  futureCount: number;
  unavailableCount: number;
};

type WatchlistAvailabilityItem = {
  remainingEpisodes: number | null;
  lastWatchedAt?: number | null;
  newEpisodeSignalAt?: number | null;
};

type WatchingWithOthersItem = WatchlistAvailabilityItem & {
  status: string;
  watchingWithOthers?: boolean;
};

type ActiveWatchlistItem = WatchingWithOthersItem & {
  watchedEpisodes: number;
  trackingState?: string | null;
};

export function shouldShowActiveWatchlistItem(
  item: ActiveWatchlistItem,
  counts: WatchlistScheduleCounts | undefined,
  mode: WatchlistAirtimeMode,
) {
  if (item.status !== "watching" && item.status !== "completed") return false;
  if (item.watchingWithOthers || item.trackingState === "upcoming") return false;

  const actionable = hasWatchlistActionableEpisode(item, counts, mode);
  const scheduleAttention = getWatchlistScheduleAttentionCount(counts, mode) > 0;
  const freshSignal = typeof item.newEpisodeSignalAt === "number" &&
    item.newEpisodeSignalAt > (item.lastWatchedAt ?? 0);

  // Explicit Watching is enough to start a queue; watching episode one is not required.
  if (item.status === "watching") return actionable;
  return item.watchedEpisodes > 0 && actionable && (scheduleAttention || freshSignal);
}

export function getWatchlistScheduleAttentionCount(
  counts: WatchlistScheduleCounts | undefined,
  mode: WatchlistAirtimeMode,
) {
  if (!counts) {
    return 0;
  }

  if (mode === "after_airtime") {
    return counts.availableCount;
  }

  return Math.max(
    0,
    counts.availableCount + (counts.unavailableCount - counts.futureCount),
  );
}

export function hasWatchlistActionableEpisode(
  item: WatchlistAvailabilityItem,
  counts: WatchlistScheduleCounts | undefined,
  mode: WatchlistAirtimeMode,
) {
  const scheduleAttentionCount = getWatchlistScheduleAttentionCount(
    counts,
    mode,
  );
  if (scheduleAttentionCount > 0) {
    return true;
  }

  if (
    typeof item.remainingEpisodes !== "number" ||
    item.remainingEpisodes <= 0
  ) {
    return false;
  }

  const hasFreshReleaseSignal =
    typeof item.newEpisodeSignalAt === "number" &&
    item.newEpisodeSignalAt > (item.lastWatchedAt ?? 0);
  if (hasFreshReleaseSignal) {
    return true;
  }

  const unavailableUpcomingCount =
    mode === "after_airtime"
      ? (counts?.unavailableCount ?? 0)
      : (counts?.futureCount ?? 0);

  return unavailableUpcomingCount < item.remainingEpisodes;
}

export function shouldShowWatchingWithOthersItem(
  item: WatchingWithOthersItem,
  counts: WatchlistScheduleCounts | undefined,
  mode: WatchlistAirtimeMode,
) {
  return (
    item.status === "watching" &&
    item.watchingWithOthers === true &&
    hasWatchlistActionableEpisode(item, counts, mode)
  );
}
