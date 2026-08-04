import type { ParsedImportEpisode } from "@/lib/import/tv-time";

function getEpisodeHistory(episode: ParsedImportEpisode) {
  if (Array.isArray(episode.watchHistory) && episode.watchHistory.length > 0) {
    return episode.watchHistory
      .filter((entry): entry is number => Number.isFinite(entry))
      .sort((a, b) => a - b);
  }
  return typeof episode.watchedAt === "number" && Number.isFinite(episode.watchedAt)
    ? [episode.watchedAt]
    : [];
}

function getEpisodeWatchCount(episode: ParsedImportEpisode, history: number[]) {
  return typeof episode.watchCount === "number" && Number.isFinite(episode.watchCount)
    ? Math.max(1, Math.floor(episode.watchCount), history.length)
    : Math.max(1, history.length);
}

function getSourceIds(episode: ParsedImportEpisode) {
  return episode.sourceEpisodeIds ??
    (episode.sourceEpisodeId ? [episode.sourceEpisodeId] : []);
}

export function mergeCanonicalImportEpisodes(
  existing: ParsedImportEpisode,
  incoming: ParsedImportEpisode
): ParsedImportEpisode {
  const existingHistory = getEpisodeHistory(existing);
  const incomingHistory = getEpisodeHistory(incoming);
  const existingSourceIds = getSourceIds(existing);
  const incomingSourceIds = getSourceIds(incoming);
  const incomingSourceIdSet = new Set(incomingSourceIds);
  const combinesProviderParts =
    existing.providerEpisodeId !== undefined &&
    existing.providerEpisodeId === incoming.providerEpisodeId &&
    existingSourceIds.length > 0 &&
    incomingSourceIds.length > 0 &&
    existingSourceIds.every((id) => !incomingSourceIdSet.has(id));

  const watchHistory = combinesProviderParts
    ? Array.from(
        { length: Math.max(existingHistory.length, incomingHistory.length) },
        (_, index) => Math.max(
          existingHistory[index] ?? Number.NEGATIVE_INFINITY,
          incomingHistory[index] ?? Number.NEGATIVE_INFINITY
        )
      ).filter(Number.isFinite)
    : Array.from(new Set([...existingHistory, ...incomingHistory])).sort((a, b) => a - b);
  const watchCount = Math.max(
    getEpisodeWatchCount(existing, existingHistory),
    getEpisodeWatchCount(incoming, incomingHistory),
    watchHistory.length
  );
  const watchedAt = [existing.watchedAt, incoming.watchedAt, ...watchHistory]
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .reduce<number | undefined>(
      (latest, value) => latest === undefined || value > latest ? value : latest,
      undefined
    );
  const sourceEpisodeIds = Array.from(
    new Set([...existingSourceIds, ...incomingSourceIds])
  );

  return {
    ...existing,
    ...incoming,
    season: existing.season,
    episode: existing.episode,
    sourceSeason: existing.sourceSeason ?? existing.season,
    sourceEpisode: existing.sourceEpisode ?? existing.episode,
    watchedAt,
    watchCount: watchCount > 1 ? watchCount : undefined,
    watchHistory: watchHistory.length > 1 ? watchHistory : undefined,
    sourceEpisodeId: existing.sourceEpisodeId ?? incoming.sourceEpisodeId,
    sourceEpisodeIds: sourceEpisodeIds.length > 0 ? sourceEpisodeIds : undefined,
  };
}
