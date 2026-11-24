import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function getWatchlistPushSettings(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db.query("watchlistPushSettings")
    .withIndex("by_user", q => q.eq("userId", userId)).unique();
}

export async function cancelWatchlistPushCheck(ctx: MutationCtx, settings: Doc<"watchlistPushSettings">) {
  if (!settings.checkId) return;
  const job = await ctx.db.system.get("_scheduled_functions", settings.checkId);
  if (job?.state.kind === "pending") await ctx.scheduler.cancel(settings.checkId);
  await ctx.db.patch(settings._id, { checkId: undefined, checkAt: undefined });
}

export async function scheduleWatchlistPushCheck(
  ctx: MutationCtx,
  settings: Doc<"watchlistPushSettings">,
  requestedTime: number,
) {
  const checkAt = Math.max(requestedTime, Date.now());
  if (settings.checkAt !== undefined && settings.checkAt <= checkAt) return;
  await cancelWatchlistPushCheck(ctx, settings);
  const checkId = await ctx.scheduler.runAt(checkAt, internal.watchlistPush.check, {
    settingsId: settings._id,
    checkAt,
  });
  await ctx.db.patch(settings._id, { checkId, checkAt });
}

export async function refreshWatchlistPush(ctx: MutationCtx, userId: Id<"users">) {
  const settings = await getWatchlistPushSettings(ctx, userId);
  if (settings?.enabled && settings.timeZone) {
    await scheduleWatchlistPushCheck(ctx, settings, Date.now());
  }
}
