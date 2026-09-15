type TrackingStatus = "watching" | "plan_to_watch" | "paused" | "dropped" | "completed";

export function resolveManualTrackingStatus(
  requested: TrackingStatus,
  mediaType: "tv" | "anime" | "movie",
  watchedEpisodes: number,
  watchingWithOthers = false,
): TrackingStatus {
  if (mediaType !== "movie" && requested === "watching" &&
      watchedEpisodes <= 0 && !watchingWithOthers) {
    return "plan_to_watch";
  }
  return requested;
}
