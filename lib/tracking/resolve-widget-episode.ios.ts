import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { WidgetWatchlistShow } from "@/components/WatchlistWidgetSnapshot";
import { getTmdbSeasonDetails, getTmdbShowDetails } from "@/lib/api/tmdb";
import { getTvMazeShowEpisodes } from "@/lib/api/tvmaze";
import { normalizeTmdbSeason, normalizeTvMazeSeasons } from "@/lib/api/normalize";
import { getAniListMediaById } from "@/lib/api/anilist";
import { getJikanAnimeEpisodes } from "@/lib/api/jikan";
import { applyConfirmedRelease } from "./confirmed-release";
import { findWidgetNextEpisodes, widgetEpisodeKey, type WidgetEpisode, type WidgetReleaseContext } from "./widget-episode";

export async function resolveWidgetEpisodes(
  convex: ConvexReactClient,
  show: WidgetWatchlistShow,
  schedule: ReadonlyMap<string, string>,
  context: WidgetReleaseContext,
) {
  const lookup = {
    tmdbId: show.tmdbId ?? undefined,
    anilistId: show.anilistId ?? undefined,
    malId: show.malId ?? undefined,
    tvmazeId: show.tvmazeId ?? undefined,
    mediaType: show.mediaType,
  };
  if (!(lookup.tmdbId || lookup.anilistId || lookup.malId || lookup.tvmazeId)) return [];

  const tracking = await convex.query(api.shows.getUserShowTracking, lookup);
  if (!tracking?.inWatchlist) return [];

  const next: WidgetEpisode[] = [];
  const maxEpisodes = 3;

  async function watchedInSeason(season: number) {
    return new Set(await convex.query(api.shows.getWatchedEpisodesForSeason, { ...lookup, season }));
  }

  function nextInSeason(episodes: readonly WidgetEpisode[], watched: ReadonlySet<string>) {
    const withReleaseDates = episodes.map((episode) => {
      const release = applyConfirmedRelease(episode, tracking?.confirmedRelease, context.now);
      const scheduledDate = schedule.get(widgetEpisodeKey(episode));
      return scheduledDate ? { ...release, airDate: scheduledDate } : release;
    });
    next.push(...findWidgetNextEpisodes(withReleaseDates, watched, context, maxEpisodes - next.length));
  }

  if (show.mediaType === "tv" && lookup.tmdbId) {
    const details = await getTmdbShowDetails("tv", lookup.tmdbId, { resolveRuntimeFallback: false });
    const seasons = [...(details.seasons ?? [])].sort((a, b) => a.season_number - b.season_number);
    for (const season of seasons) {
      if (season.season_number <= 0 || season.episode_count === 0) continue;
      const watched = await watchedInSeason(season.season_number);
      if (season.episode_count && Array.from({ length: season.episode_count }, (_, index) => index + 1)
        .every((number) => watched.has(`${season.season_number}:${number}`))) continue;
      const seasonDetails = await getTmdbSeasonDetails(lookup.tmdbId, season.season_number);
      nextInSeason(normalizeTmdbSeason(seasonDetails).episodes ?? [], watched);
      if (next.length >= maxEpisodes) break;
    }
  }

  if (show.mediaType === "tv" && lookup.tvmazeId && !lookup.tmdbId) {
    for (const season of normalizeTvMazeSeasons(await getTvMazeShowEpisodes(lookup.tvmazeId))) {
      nextInSeason(season.episodes ?? [], await watchedInSeason(season.seasonNumber));
      if (next.length >= maxEpisodes) break;
    }
  }

  if (show.mediaType === "anime") {
    const malId = lookup.malId ?? (lookup.anilistId ? (await getAniListMediaById(lookup.anilistId))?.malId : null);
    if (malId) {
      const [episodes, watched] = await Promise.all([getJikanAnimeEpisodes(malId), watchedInSeason(1)]);
      nextInSeason(episodes, watched);
    }
  }

  return next;
}
