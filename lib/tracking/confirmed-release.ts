export type ConfirmedRelease = {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  tmdbAirDate: string;
  airTimestamp: number;
  releasedEpisodes: number;
  verifiedAt: number;
};

const DAY = 86_400_000;

export function isConfirmedReleaseValid(value: ConfirmedRelease, now = Date.now()) {
  const original = Date.parse(value.tmdbAirDate + "T00:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(value.tmdbAirDate) &&
    Number.isFinite(original) && Number.isFinite(value.airTimestamp) &&
    value.airTimestamp < original && original - value.airTimestamp <= DAY &&
    value.airTimestamp <= now && value.verifiedAt >= value.airTimestamp &&
    value.verifiedAt <= now + 60_000 &&
    [value.seasonNumber, value.episodeNumber, value.releasedEpisodes].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) && value.name.length > 0 && value.name.length <= 200;
}

// A short-lived floor prevents a date-only metadata refresh undoing an exact
// confirmed release. It cannot expand the catalogue or mask a later correction.
export function confirmedReleaseFloor(
  incoming: number | undefined,
  total: number | undefined,
  value: ConfirmedRelease | undefined,
  now = Date.now(),
) {
  if (!value || !isConfirmedReleaseValid(value, now) ||
      now > Date.parse(value.tmdbAirDate + "T00:00:00Z") + DAY ||
      typeof total !== "number" || total < value.releasedEpisodes) return incoming;
  return Math.max(incoming ?? 0, value.releasedEpisodes);
}

export function applyConfirmedRelease<T extends {
  seasonNumber: number; episodeNumber: number; airDate?: string | null;
}>(episode: T, value: ConfirmedRelease | null | undefined, now = Date.now()): T {
  if (!value || !isConfirmedReleaseValid(value, now) ||
      episode.seasonNumber !== value.seasonNumber ||
      episode.episodeNumber !== value.episodeNumber ||
      episode.airDate !== value.tmdbAirDate) return episode;
  return { ...episode, airDate: new Date(value.airTimestamp).toISOString() };
}
