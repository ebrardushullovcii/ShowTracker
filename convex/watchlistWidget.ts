"use node";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { v, type Infer } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireApproved } from "./lib/accessPolicy";
import { parseShowRouteId } from "../lib/show-route";

const position = v.object({ season: v.number(), episode: v.number() });
const entry = v.object({ routeId: v.string(), episodes: v.array(position) });
const duration = 7 * 24 * 60 * 60 * 1000;

type Grant = {
  userId: Id<"users">;
  sessionId: Id<"authSessions">;
  expiresAt: number;
  rows: Infer<typeof entry>[];
};

function sign(payload: string) {
  const secret = process.env.JWT_PRIVATE_KEY;
  if (!secret) throw new Error("Widget signing is unavailable.");
  return createHmac("sha256", secret).update(`showtracker:watchlist-widget:v1:${payload}`).digest("base64url");
}

export const issue = action({
  args: { rows: v.array(entry) },
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, { rows }) => {
    await requireApproved(ctx);
    const [userId, sessionId] = await Promise.all([getAuthUserId(ctx), getAuthSessionId(ctx)]);
    if (!userId || !sessionId) throw new Error("Sign in to continue.");
    if (!rows.length || rows.length > 4 || rows.some(({ routeId, episodes }) => {
      const route = parseShowRouteId(routeId);
      return !route || routeId.length > 80 || routeId.split(":").length !== 3 || route.mediaType === "movie" ||
        route.source === "imdb" || !episodes.length || episodes.length > 3 ||
        episodes.some(({ season, episode }) => !Number.isSafeInteger(season) || season < 1 ||
          !Number.isSafeInteger(episode) || episode < 1);
    })) throw new Error("Invalid widget episodes.");

    const expiresAt = Date.now() + duration;
    const grant: Grant = { userId, sessionId, expiresAt, rows };
    const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
    return { token: `${payload}.${sign(payload)}`, expiresAt };
  },
});

export const mark = action({
  args: { token: v.string(), routeId: v.string(), season: v.number(), episode: v.number() },
  returns: v.object({ saved: v.boolean(), next: v.union(position, v.null()) }),
  handler: async (ctx, { token, routeId, season, episode }): Promise<{ saved: boolean; next: Infer<typeof position> | null }> => {
    const rejected = { saved: false, next: null } as const;
    if (token.length > 4096 || !/^[\w-]+\.[\w-]{43}$/.test(token)) return rejected;
    const [payload, signature] = token.split(".");
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return rejected;

    // Only the server can mint this payload. The mutation also rechecks the live session.
    const grant = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Grant;
    if (grant.expiresAt <= Date.now()) return rejected;
    const row = grant.rows.find((row) => row.routeId === routeId);
    const index = row?.episodes.findIndex((p) => p.season === season && p.episode === episode) ?? -1;
    if (!row || index < 0) return rejected;

    return ctx.runMutation(internal.shows.markWatchlistWidgetEpisode, {
      userId: grant.userId,
      sessionId: grant.sessionId,
      expiresAt: grant.expiresAt,
      routeId,
      position: { season, episode },
      following: row.episodes.slice(index + 1),
    });
  },
});
