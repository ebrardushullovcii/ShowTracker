import type { NormalizedSeason } from "../api/types";

export function findUnloadedRailSeason(
  seasons: NormalizedSeason[],
  boundary: number,
  direction: "previous" | "next",
) {
  const ordered = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  if (direction === "previous") {
    return ordered.reverse().find((season) =>
      season.seasonNumber < boundary && season.episodes === undefined
    ) ?? null;
  }

  return ordered.find((season) =>
    season.seasonNumber > boundary && season.episodes === undefined
  ) ?? null;
}
