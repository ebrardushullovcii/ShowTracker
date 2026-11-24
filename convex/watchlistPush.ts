import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { isOwner } from "./lib/accessPolicy";
import { mutation, query } from "./lib/approvedFunctions";
import {
  cancelWatchlistPushCheck,
  getWatchlistPushSettings,
  scheduleWatchlistPushCheck,
} from "./lib/watchlistPushSchedule";
import { getWatchlistEpisodeCandidates } from "./schedule";
import {
  hasWatchlistActionableEpisode,
  shouldShowActiveWatchlistItem,
  shouldShowWatchingWithOthersItem,
  type WatchlistAirtimeMode,
} from "../lib/tracking/home-watchlist-visibility";
import {
  normalizeWatchlistTimeZone,
  shiftWatchlistDate,
  watchlistDayBuckets,
  watchlistDayStart,
  watchlistEpisodeTiming,
  watchlistLocalDate,
} from "../lib/tracking/watchlist-episode-timing";
import { getWatchlistNotificationBody } from "../lib/tracking/watchlist-notification-copy";

const DAY_MS = 86_400_000;
const KEEP_DELIVERIES_MS = 90 * DAY_MS;
const EXPO_API = "https://exp.host/--/api/v2/push";

const notificationValidator = v.object({
  title: v.string(), body: v.string(), routeId: v.string(), dueAt: v.number(),
  passive: v.boolean(),
});

async function accountCanReceivePush(ctx: QueryCtx, userId: Id<"users">) {
  const [user, deletion] = await Promise.all([
    ctx.db.get(userId),
    ctx.db.query("accountDeletions").withIndex("by_user", q => q.eq("userId", userId)).first(),
  ]);
  return !!user && !deletion && (user.approvalStatus !== "pending" || isOwner(userId));
}

async function activePushDevices(ctx: QueryCtx, userId: Id<"users">, now: number) {
  const devices = await ctx.db.query("watchlistPushDevices")
    .withIndex("by_user", q => q.eq("userId", userId)).collect();
  const sessions = await Promise.all(devices.map(device => ctx.db.get(device.sessionId)));
  return devices.filter((device, i) =>
    sessions[i]?.userId === device.userId && sessions[i]!.expirationTime > now);
}

export const preferences = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    const settings = userId ? await getWatchlistPushSettings(ctx, userId) : null;
    return { enabled: settings?.enabled ?? true };
  },
});

export const setEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || !await accountCanReceivePush(ctx, userId)) throw new Error("Account unavailable.");
    const settings = await getWatchlistPushSettings(ctx, userId);
    const now = Date.now();
    if (!settings) {
      await ctx.db.insert("watchlistPushSettings", { userId, enabled, enabledAt: now });
      return;
    }
    if (settings.enabled === enabled) return;
    await ctx.db.patch(settings._id, { enabled, enabledAt: now });
    if (!enabled) await cancelWatchlistPushCheck(ctx, settings);
    else if (settings.timeZone) await scheduleWatchlistPushCheck(ctx, settings, now);
  },
});

export const registerDevice = mutation({
  args: { token: v.string(), timeZone: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const sessionId = await getAuthSessionId(ctx);
    const session = sessionId ? await ctx.db.get(sessionId) : null;
    const now = Date.now();
    if (!userId || !sessionId || !session || session.userId !== userId ||
        session.expirationTime <= now || !await accountCanReceivePush(ctx, userId)) {
      throw new Error("Account unavailable.");
    }
    if (!/^(?:ExponentPushToken|ExpoPushToken)\[[\w-]{8,128}\]$/.test(args.token)) {
      throw new Error("Invalid push token.");
    }
    const timeZone = normalizeWatchlistTimeZone(args.timeZone);
    const device = await ctx.db.query("watchlistPushDevices")
      .withIndex("by_token", q => q.eq("token", args.token)).unique();
    const alreadyRegistered = device?.userId === userId && device.sessionId === sessionId;
    if (!alreadyRegistered) {
      const fields = { userId, sessionId, registeredAt: now };
      if (device) await ctx.db.patch(device._id, fields);
      else await ctx.db.insert("watchlistPushDevices", { ...fields, token: args.token });
    }

    const settings = await getWatchlistPushSettings(ctx, userId);
    if (!settings) {
      const id = await ctx.db.insert("watchlistPushSettings", { userId, timeZone, enabled: true, enabledAt: now });
      await scheduleWatchlistPushCheck(ctx, (await ctx.db.get(id))!, now);
    } else if (settings.timeZone !== timeZone || !alreadyRegistered || !settings.checkAt) {
      if (settings.timeZone !== timeZone) await ctx.db.patch(settings._id, { timeZone });
      if (settings.enabled) await scheduleWatchlistPushCheck(ctx, settings, now);
    }
  },
});

export const unregisterDevice = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await getAuthUserId(ctx);
    const sessionId = await getAuthSessionId(ctx);
    const device = await ctx.db.query("watchlistPushDevices")
      .withIndex("by_token", q => q.eq("token", token)).unique();
    if (userId && device?.userId === userId && device.sessionId === sessionId) {
      await ctx.db.delete(device._id);
    }
  },
});

function canShowEpisode(
  projection: Doc<"feedProjections">,
  mode: WatchlistAirtimeMode,
) {
  // This episode is already matched and unwatched, and its chosen Home timing is due.
  const item = {
    ...projection, remainingEpisodes: projection.remainingEpisodes ?? null,
    watchedEpisodes: projection.watchedEpisodesCount,
  };
  const counts = { availableCount: 1, futureCount: 0, unavailableCount: 0 };
  if (item.status === "paused") {
    return item.watchedEpisodes > 0 && item.autoPausedAt !== undefined &&
      hasWatchlistActionableEpisode(item, counts, mode);
  }
  return shouldShowActiveWatchlistItem(item, counts, mode) ||
    shouldShowWatchingWithOthersItem(item, counts, mode);
}

export const check = internalMutation({
  args: { settingsId: v.id("watchlistPushSettings"), checkAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { settingsId, checkAt }) => {
    const settings = await ctx.db.get(settingsId);
    if (settings?.checkAt !== checkAt) return null;
    await ctx.db.patch(settingsId, { checkAt: undefined, checkId: undefined });
    const { userId, timeZone } = settings;
    if (!settings.enabled || !timeZone || !await accountCanReceivePush(ctx, userId)) return null;

    const now = Date.now();
    const devices = await activePushDevices(ctx, userId, now);
    if (!devices.length) return null;
    const pref = await ctx.db.query("userAnimeHomeSettings")
      .withIndex("by_user", q => q.eq("userId", userId)).unique();
    const mode = pref?.watchlistAirtimeMode ?? "same_day";
    const today = watchlistLocalDate(now, timeZone);
    const dayStart = watchlistDayStart(today, timeZone);
    const buckets = watchlistDayBuckets(today, timeZone);
    let nextCheckAt = watchlistDayStart(shiftWatchlistDate(today, 1), timeZone);
    const candidates = await getWatchlistEpisodeCandidates(ctx, {
      userId, startDate: shiftWatchlistDate(buckets.startDate, -1),
      endDate: shiftWatchlistDate(buckets.endDate, 1),
    });
    const due = new Map<string, {
      title: string; routeId: string; dueAt: number; airtime: number | null;
      episodes: typeof candidates[number]["episode"][];
    }>();

    for (const candidate of candidates) {
      const { projection, episode, date, routeId } = candidate;
      const timing = watchlistEpisodeTiming(date, episode.airDate, timeZone);
      if (timing.day !== today) continue;
      const dueAt = mode === "same_day" ? dayStart : timing.airtime ?? dayStart;
      if (dueAt > now) {
        nextCheckAt = Math.min(nextCheckAt, dueAt);
        continue;
      }
      if (!canShowEpisode(projection, mode)) continue;
      if (dueAt < settings.enabledAt || !devices.some(device => device.registeredAt <= dueAt)) continue;
      const episodeKey = `${projection.showId}:${episode.seasonNumber}:${episode.episodeNumber}`;
      const sent = await ctx.db.query("watchlistPushDeliveries")
        .withIndex("by_user_episode", q => q.eq("userId", userId).eq("episodeKey", episodeKey)).unique();
      if (sent) continue;
      await ctx.db.insert("watchlistPushDeliveries", { userId, episodeKey, createdAt: now });
      const groupKey = `${projection.showId}:${dueAt}`;
      const group = due.get(groupKey) ?? {
        title: projection.title, routeId, dueAt, airtime: timing.airtime, episodes: [],
      };
      group.episodes.push(episode);
      if (group.airtime !== timing.airtime) group.airtime = null;
      due.set(groupKey, group);
    }

    for (const group of due.values()) {
      await ctx.scheduler.runAfter(0, internal.watchlistPush.deliver, {
        userId,
        notification: {
          title: group.title, routeId: group.routeId, dueAt: group.dueAt,
          passive: mode === "same_day" || group.airtime === null,
          body: getWatchlistNotificationBody({
            showTitle: group.title, episodes: group.episodes, timeZone,
            airtime: mode === "same_day" && group.airtime !== null && group.airtime <= now ? null : group.airtime,
            timing: group.airtime === null ? "date_only" : mode,
          }),
        },
      });
    }

    const expired = await ctx.db.query("watchlistPushDeliveries")
      .withIndex("by_user_created", q => q.eq("userId", userId).lt("createdAt", now - KEEP_DELIVERIES_MS))
      .take(50);
    for (const entry of expired) await ctx.db.delete(entry._id);
    await scheduleWatchlistPushCheck(ctx, { ...settings, checkAt: undefined, checkId: undefined }, nextCheckAt);
    return null;
  },
});

export const devicesForDelivery = internalQuery({
  args: { userId: v.id("users"), dueAt: v.number() },
  handler: async (ctx, { userId, dueAt }): Promise<Doc<"watchlistPushDevices">[]> => {
    const settings = await getWatchlistPushSettings(ctx, userId);
    if (!settings?.enabled || settings.enabledAt > dueAt || !await accountCanReceivePush(ctx, userId)) return [];
    const devices = await activePushDevices(ctx, userId, Date.now());
    return devices.filter(device => device.registeredAt <= dueAt);
  },
});

function expoHeaders() {
  return {
    "Content-Type": "application/json",
    ...(process.env.EXPO_PUSH_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}` } : {}),
  };
}

type PushTicket = { status: string; id?: string; details?: { error?: string } };

export const deliver = internalAction({
  args: { userId: v.id("users"), notification: notificationValidator },
  returns: v.null(),
  handler: async (ctx, { userId, notification }) => {
    const devices = await ctx.runQuery(internal.watchlistPush.devicesForDelivery, {
      userId, dueAt: notification.dueAt,
    });
    for (let i = 0; i < devices.length; i += 100) {
      const batch = devices.slice(i, i + 100);
      const response = await fetch(`${EXPO_API}/send`, {
        method: "POST", headers: expoHeaders(),
        body: JSON.stringify(batch.map(device => ({
          to: device.token,
          title: notification.title, body: notification.body,
          data: { watchlistRouteId: notification.routeId },
          ttl: 86_400,
          ...(notification.passive ? { interruptionLevel: "passive" } : { sound: "default" }),
        }))),
      });
      if (!response.ok) throw new Error(`Expo push request returned ${response.status}.`);
      const result = await response.json() as { data?: PushTicket[] };
      const receipts: Array<{ id: string; deviceId: Id<"watchlistPushDevices"> }> = [];
      const invalid: Id<"watchlistPushDevices">[] = [];
      result.data?.forEach((ticket, index) => {
        const device = batch[index];
        if (!device) return;
        if (ticket.status === "ok" && ticket.id) receipts.push({ id: ticket.id, deviceId: device._id });
        else if (ticket.details?.error === "DeviceNotRegistered") invalid.push(device._id);
        else console.warn("Watchlist push rejected", ticket.details?.error ?? "unknown");
      });
      if (invalid.length) await ctx.runMutation(internal.watchlistPush.removeInvalidDevices, { ids: invalid });
      if (receipts.length) await ctx.scheduler.runAfter(15 * 60_000, internal.watchlistPush.checkReceipts, { receipts });
    }
    return null;
  },
});

export const checkReceipts = internalAction({
  args: { receipts: v.array(v.object({ id: v.string(), deviceId: v.id("watchlistPushDevices") })) },
  returns: v.null(),
  handler: async (ctx, { receipts }) => {
    const response = await fetch(`${EXPO_API}/getReceipts`, {
      method: "POST", headers: expoHeaders(), body: JSON.stringify({ ids: receipts.map(receipt => receipt.id) }),
    });
    if (!response.ok) throw new Error(`Expo receipt request returned ${response.status}.`);
    const result = await response.json() as { data?: Record<string, PushTicket> };
    const invalid = receipts.flatMap(({ id, deviceId }) => {
      const receipt = result.data?.[id];
      if (receipt?.details?.error === "DeviceNotRegistered") return [deviceId];
      if (receipt?.status === "error") console.warn("Watchlist push delivery failed", receipt.details?.error ?? "unknown");
      return [];
    });
    if (invalid.length) await ctx.runMutation(internal.watchlistPush.removeInvalidDevices, { ids: invalid });
    return null;
  },
});

export const removeInvalidDevices = internalMutation({
  args: { ids: v.array(v.id("watchlistPushDevices")) },
  returns: v.null(),
  handler: async (ctx, { ids }) => {
    for (const id of new Set(ids)) if (await ctx.db.get(id)) await ctx.db.delete(id);
    return null;
  },
});
