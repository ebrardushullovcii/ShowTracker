import type { PropsWithChildren } from "react";
import type { WatchlistAirtimeMode } from "@/lib/tracking/home-watchlist-visibility";

export function WatchlistPushProvider({ children }: PropsWithChildren<{ canReceive: boolean }>) {
  return children;
}

export function WatchlistPushPreference(_props: { mode: WatchlistAirtimeMode }) {
  return null;
}
