import type { MediaType } from "@/lib/api/types";
import type { WatchlistAirtimeMode } from "@/lib/tracking/home-watchlist-visibility";

export type WidgetWatchlistShow = {
  routeId: string;
  title: string;
  posterUrl: string | null;
  mediaType: MediaType;
  tmdbId: number | null;
  anilistId: number | null;
  malId: number | null;
  tvmazeId?: number | null;
  remainingEpisodes: number | null;
  watchedEpisodes: number;
  lastWatchedAt?: number | null;
};

export type WatchlistWidgetProps = {
  day: string;
  timeZone: string;
  airtimeMode: WatchlistAirtimeMode;
  items: readonly WidgetWatchlistShow[] | undefined;
  futureRoutes: ReadonlySet<string> | undefined;
};

export function WatchlistWidgetSnapshot(_props: WatchlistWidgetProps) {
  return null;
}

export function ClearWatchlistWidget(_props: { clear: boolean }) {
  return null;
}
