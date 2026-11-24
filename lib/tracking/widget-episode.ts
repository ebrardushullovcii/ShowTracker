import type { WatchlistAirtimeMode } from "./home-watchlist-visibility";
import { watchlistDayStart, watchlistEpisodeTiming } from "./watchlist-episode-timing";

export type WidgetEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  airDate?: string;
};

export type WidgetReleaseContext = {
  day: string;
  timeZone: string;
  airtimeMode: WatchlistAirtimeMode;
  now: number;
};

export function widgetEpisodeKey(episode: WidgetEpisode) {
  return `${episode.seasonNumber}:${episode.episodeNumber}`;
}

export function widgetEpisodeRelease(episode: WidgetEpisode, context: WidgetReleaseContext, fallbackDay?: string) {
  const day = episode.airDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? fallbackDay;
  if (!day) return null;

  const timing = watchlistEpisodeTiming(day, episode.airDate, context.timeZone);
  const availableAt = context.airtimeMode === "after_airtime" && timing.airtime !== null
    ? timing.airtime
    : watchlistDayStart(timing.day, context.timeZone);
  return { ...timing, availableAt };
}

export function findWidgetNextEpisodes<T extends WidgetEpisode>(
  episodes: readonly T[],
  watched: ReadonlySet<string>,
  context: WidgetReleaseContext,
  limit: number,
) {
  const next: T[] = [];
  const seen = new Set(watched);
  const ordered = [...episodes].sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
  for (const episode of ordered) {
    if (next.length >= limit) break;
    const key = widgetEpisodeKey(episode);
    if (episode.seasonNumber < 1 || episode.episodeNumber < 1 || seen.has(key)) continue;
    const release = widgetEpisodeRelease(episode, context);
    if (!release || release.availableAt > context.now) continue;
    seen.add(key);
    next.push(episode);
  }
  return next;
}
