import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { buildWatchedEpisodeRanges } from "../lib/tracking/watched-episode-ranges";

const resultValidator = v.object({ continueCursor: v.string(), isDone: v.boolean(), scanned: v.number(), updated: v.number(), skippedOversized: v.number(), historyRows: v.number(), historyBytes: v.number(), summaryBytes: v.number() });
type BackfillResult = { continueCursor: string; isDone: boolean; scanned: number; updated: number; skippedOversized: number; historyRows: number; historyBytes: number; summaryBytes: number };

// Explicit deployment migration, never invoked from app navigation or a timer.
export const backfillPage = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: resultValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db.query("userShows").paginate({ ...args.paginationOpts, numItems: 1 });
    let updated = 0, skippedOversized = 0, historyRows = 0, historyBytes = 0, summaryBytes = 0;
    for (const row of page.page) {
      if (row.watchedEpisodeRanges !== undefined) continue;
      const watched = await ctx.db.query("watchedEpisodes")
        .withIndex("by_user_show", q => q.eq("userId", row.userId).eq("showId", row.showId))
        .take(8193);
      if (watched.length > 8192) { skippedOversized++; continue; }
      const ranges = buildWatchedEpisodeRanges(watched);
      historyRows += watched.length;
      historyBytes += new TextEncoder().encode(JSON.stringify(watched)).length;
      summaryBytes += new TextEncoder().encode(ranges).length;
      await ctx.db.patch(row._id, { watchedEpisodeRanges: ranges });
      updated++;
    }
    return { continueCursor: page.continueCursor, isDone: page.isDone, scanned: page.page.length, updated, skippedOversized, historyRows, historyBytes, summaryBytes };
  },
});

export const backfillBatch = internalAction({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: resultValidator,
  handler: async (ctx, args): Promise<BackfillResult> => {
    const totals: BackfillResult = { continueCursor: args.cursor ?? "", isDone: false, scanned: 0, updated: 0, skippedOversized: 0, historyRows: 0, historyBytes: 0, summaryBytes: 0 };
    for (let i = 0; i < 100; i++) {
      const result: BackfillResult = await ctx.runMutation(internal.watchedEpisodeRanges.backfillPage, {
        paginationOpts: { cursor: i === 0 ? args.cursor : totals.continueCursor, numItems: 1 },
      });
      for (const key of ["scanned", "updated", "skippedOversized", "historyRows", "historyBytes", "summaryBytes"] as const) totals[key] += result[key];
      totals.continueCursor = result.continueCursor;
      totals.isDone = result.isDone;
      if (result.isDone) break;
    }
    return totals;
  },
});
