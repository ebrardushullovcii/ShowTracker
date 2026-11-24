import { useEffect, useRef } from "react";
import { useConvex, useQuery } from "convex/react";
import { requireOptionalNativeModule } from "expo";
import { api } from "@/convex/_generated/api";
import { toHttpsImageUrl } from "@/lib/image-url";
import { parseShowRouteId } from "@/lib/show-route";
import { resolveWidgetEpisodes } from "@/lib/tracking/resolve-widget-episode.ios";
import { shiftWatchlistDate, watchlistDayStart } from "@/lib/tracking/watchlist-episode-timing";
import { widgetEpisodeKey, widgetEpisodeRelease } from "@/lib/tracking/widget-episode";
import type { WatchlistWidgetProps } from "./WatchlistWidgetSnapshot";

const storage = requireOptionalNativeModule<{ publish: (snapshot: string | null) => void }>("WatchlistWidgetStorage");
const widgetShowLimit = 4;

type WidgetRow = {
  kind: "continueWatching" | "upcoming";
  title: string;
  routeId: string;
  posterUrl: string;
  seasonNumber: number;
  episodeNumber: number;
  expiresAt: number;
  newTodayUntil?: number;
  scheduledAt?: number;
  hasExactAirtime?: boolean;
  following?: { seasonNumber: number; episodeNumber: number; newTodayUntil?: number }[];
};

type WidgetGrant = { token: string; expiresAt: number };

function updateSnapshot(snapshot: string | null) {
  storage?.publish(snapshot);
}

export function WatchlistWidgetSnapshot({ day, timeZone, airtimeMode, items, futureRoutes }: WatchlistWidgetProps) {
  const convex = useConvex();
  const savedGrant = useRef<{ key: string; grant: WidgetGrant } | null>(null);
  const needsSchedule = !!(items?.length || futureRoutes?.size);
  const schedule = useQuery(api.schedule.getUpcomingSchedule, storage && items && needsSchedule ? {
    startDate: shiftWatchlistDate(day, -1),
    endDate: shiftWatchlistDate(day, items.length ? 1 : 28),
  } : "skip");

  useEffect(() => {
    if (!storage || !items) return;
    if (!needsSchedule) {
      updateSnapshot(null);
      return;
    }
    if (!schedule) return;
    let disposed = false;
    const publish = async (rows: WidgetRow[]) => {
      if (disposed) return;
      if (!rows.length) {
        updateSnapshot(null);
        return;
      }

      const entries = rows.filter(({ kind, routeId }) => kind === "continueWatching" &&
        parseShowRouteId(routeId)?.source !== "imdb").map((row) => ({
        routeId: row.routeId,
        episodes: [row, ...(row.following ?? [])].map(({ seasonNumber, episodeNumber }) => ({
          season: seasonNumber,
          episode: episodeNumber,
        })),
      }));
      const key = JSON.stringify(entries);
      let grant: WidgetGrant | null = null;
      if (entries.length) {
        const cached = savedGrant.current;
        grant = cached?.key === key && cached.grant.expiresAt > Date.now() + 86_400_000
          ? cached.grant
          : await convex.action(api.watchlistWidget.issue, { rows: entries }).catch(() => null);
      }
      if (disposed) return;
      savedGrant.current = grant ? { key, grant } : null;
      updateSnapshot(JSON.stringify({ rows, grant, convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL }));
    };

    async function refresh(shows: NonNullable<typeof items>, groups: NonNullable<typeof schedule>) {
      const context = { day, timeZone, airtimeMode, now: Date.now() };
      const releases = groups.flatMap((group) => group.episodes.map((entry) => ({ ...entry, date: group.date })));
      const tomorrow = watchlistDayStart(shiftWatchlistDate(day, 1), timeZone);
      const rows: WidgetRow[] = [];

      // Each lookup can read multiple seasons. Keep the widget's extra work bounded.
      for (const show of shows.slice(0, 6)) {
        const datesByEpisode = new Map<string, string>();
        for (const release of releases) {
          if (release.routeId === show.routeId) {
            datesByEpisode.set(widgetEpisodeKey(release.episode), release.episode.airDate ?? release.date);
          }
        }
        const episodes = await resolveWidgetEpisodes(convex, show, datesByEpisode, context).catch(() => []);
        if (disposed) return;
        const [episode, ...following] = episodes;
        if (!episode) continue;
        rows.push({
          kind: "continueWatching",
          title: show.title,
          routeId: show.routeId,
          posterUrl: toHttpsImageUrl(show.posterUrl),
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          newTodayUntil: widgetEpisodeRelease(episode, context)?.day === day ? tomorrow : undefined,
          following: following.map(({ seasonNumber, episodeNumber, airDate }) => ({
            seasonNumber,
            episodeNumber,
            newTodayUntil: widgetEpisodeRelease({ seasonNumber, episodeNumber, airDate }, context)?.day === day
              ? tomorrow : undefined,
          })),
          expiresAt: watchlistDayStart(shiftWatchlistDate(day, 7), timeZone),
        });
        if (rows.length === widgetShowLimit) break;
      }

      // Only show an upcoming release when Home found no available backlog.
      if (shows.length) {
        await publish(rows);
        return;
      }
      const upcoming = releases.flatMap((release) => {
        if (!release.routeId || !futureRoutes?.has(release.routeId) ||
            release.episode.seasonNumber < 1 || release.episode.episodeNumber < 1) return [];
        const route = parseShowRouteId(release.routeId);
        if (!route || route.source === "imdb") return [];
        const timing = widgetEpisodeRelease(release.episode, context, release.date);
        return timing && timing.availableAt > context.now ? [{ release, routeId: release.routeId, route, timing }] : [];
      }).sort((a, b) => a.timing.availableAt - b.timing.availableAt);

      const lookupField = { tmdb: "tmdbId", anilist: "anilistId", jikan: "malId", tvmaze: "tvmazeId" } as const;
      const selectedRoutes = new Set<string>();
      for (const { release, routeId, route, timing } of upcoming.slice(0, 8)) {
        if (selectedRoutes.has(routeId)) continue;
        const watched = await convex.query(api.shows.getWatchedEpisodesForSeason, {
          [lookupField[route.source]]: route.externalId,
          mediaType: route.mediaType,
          season: release.episode.seasonNumber,
        }).catch(() => null);
        if (disposed) return;
        if (!watched || watched.includes(widgetEpisodeKey(release.episode))) continue;
        rows.push({
          kind: "upcoming",
          title: release.showTitle,
          routeId,
          posterUrl: toHttpsImageUrl(release.posterUrl),
          seasonNumber: release.episode.seasonNumber,
          episodeNumber: release.episode.episodeNumber,
          scheduledAt: timing.airtime ?? watchlistDayStart(timing.day, timeZone),
          hasExactAirtime: timing.airtime !== null,
          expiresAt: watchlistDayStart(shiftWatchlistDate(timing.day, 1), timeZone),
        });
        selectedRoutes.add(routeId);
        if (rows.length === widgetShowLimit) break;
      }
      await publish(rows);
    }

    void refresh(items, schedule);
    return () => { disposed = true; };
  }, [airtimeMode, convex, day, futureRoutes, items, needsSchedule, schedule, timeZone]);

  return null;
}

export function ClearWatchlistWidget({ clear }: { clear: boolean }) {
  useEffect(() => {
    if (clear) updateSnapshot(null);
  }, [clear]);

  return null;
}
