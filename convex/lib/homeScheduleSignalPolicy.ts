export type HomeScheduleSignalProjectionState = {
  lastWatchedAt: number;
  remainingEpisodes?: number;
};

export function isHomeScheduleSignalActionable(
  projection: HomeScheduleSignalProjectionState,
  signalAt: number
) {
  return !(
    typeof projection.remainingEpisodes === "number" &&
    projection.remainingEpisodes <= 0 &&
    signalAt <= projection.lastWatchedAt
  );
}
