import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import type { Id, TableNames } from "./_generated/dataModel";
import { DELETION_FINAL_SWEEP_DELAY_MS } from "./lib/authPolicy";

const BATCH_SIZE = 100;
const PAGE = { cursor: null, numItems: BATCH_SIZE, maximumBytesRead: 1_000_000 };
type OwnedReader = (ctx: MutationCtx, userId: Id<"users">) => Promise<{ _id: Id<TableNames> }[]>;

// Shared catalogue and provider caches have no account ownership and stay intact.
const ownedReaders: OwnedReader[] = [
  async (ctx, id) => (await ctx.db.query("sharedGames").withIndex("by_ownerId", q => q.eq("ownerId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("watchedEpisodes").withIndex("by_user", q => q.eq("userId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("userShows").withIndex("by_user", q => q.eq("userId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("userFavorites").withIndex("by_user", q => q.eq("userId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("customLists").withIndex("by_user", q => q.eq("userId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("feedProjections").withIndex("by_user", q => q.eq("userId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("userScheduleEvents").withIndex("by_user", q => q.eq("userId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("watchlistFutureCountProjections").withIndex("by_user", q => q.eq("userId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("userScheduleProjectionWindows").withIndex("by_user", q => q.eq("userId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("userAnimeHomeSettings").withIndex("by_user", q => q.eq("userId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("userAnimeFranchiseSettings").withIndex("by_user", q => q.eq("userId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("userProfiles").withIndex("by_userId", q => q.eq("userId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("userSocial").withIndex("by_user", q => q.eq("userId", id)).paginate(PAGE)).page,
  async (ctx, id) => (await ctx.db.query("userStats").withIndex("by_user", q => q.eq("userId", id)).paginate(PAGE)).page,
];

export const request = mutation({
  args: { confirmation: v.literal("DELETE") },
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in before deleting your account.");
    const existing = await ctx.db.query("accountDeletions")
      .withIndex("by_user", q => q.eq("userId", userId)).first();
    if (existing) return null;
    if (!await ctx.db.get(userId)) throw new ConvexError("Account not found.");
    const deletionId = await ctx.db.insert("accountDeletions", {
      userId, stage: 0, finalPass: false, startedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.accountDeletion.runBatch, { deletionId });
    return null;
  },
});

export const runBatch = internalMutation({
  args: { deletionId: v.id("accountDeletions") },
  returns: v.null(),
  handler: async (ctx, { deletionId }) => {
    const job = await ctx.db.get(deletionId);
    if (!job) return null;
    const again = () => ctx.scheduler.runAfter(0, internal.accountDeletion.runBatch, { deletionId });

    if (job.stage === 0) {
      const session = await ctx.db.query("authSessions")
        .withIndex("userId", q => q.eq("userId", job.userId)).first();
      if (session) {
        const tokens = await ctx.db.query("authRefreshTokens")
          .withIndex("sessionId", q => q.eq("sessionId", session._id)).take(BATCH_SIZE);
        const verifiers = await ctx.db.query("authVerifiers")
          .withIndex("by_sessionId", q => q.eq("sessionId", session._id)).take(BATCH_SIZE);
        for (const row of [...tokens, ...verifiers]) await ctx.db.delete(row._id);
        if (!tokens.length && !verifiers.length) await ctx.db.delete(session._id);
        await again();
        return null;
      }
    } else if (job.stage === 1) {
      const account = await ctx.db.query("authAccounts")
        .withIndex("userIdAndProvider", q => q.eq("userId", job.userId)).first();
      if (account) {
        const codes = await ctx.db.query("authVerificationCodes")
          .withIndex("accountId", q => q.eq("accountId", account._id)).take(BATCH_SIZE);
        const limits = await ctx.db.query("authRateLimits")
          .withIndex("identifier", q => q.eq("identifier", account._id)).take(BATCH_SIZE);
        for (const row of [...codes, ...limits]) await ctx.db.delete(row._id);
        if (!codes.length && !limits.length) await ctx.db.delete(account._id);
        await again();
        return null;
      }
    } else {
      const reader = ownedReaders[job.stage - 2];
      if (reader) {
        const rows = await reader(ctx, job.userId);
        for (const row of rows) await ctx.db.delete(row._id);
        if (rows.length) {
          await again();
          return null;
        }
      } else {
        if (await ctx.db.get(job.userId)) await ctx.db.delete(job.userId);
        if (job.finalPass) {
          await ctx.db.delete(deletionId);
        } else {
          await ctx.db.patch(deletionId, { stage: 0, finalPass: true });
          await ctx.scheduler.runAfter(
            Math.max(0, job.startedAt + DELETION_FINAL_SWEEP_DELAY_MS - Date.now()),
            internal.accountDeletion.runBatch, { deletionId },
          );
        }
        return null;
      }
    }
    await ctx.db.patch(deletionId, { stage: job.stage + 1 });
    await again();
    return null;
  },
});
