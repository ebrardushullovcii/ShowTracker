import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { sharedGameFields } from "./shareValidators";
import { normalizeSharedGame } from "../lib/sharing/share-link";

export const createSnapshot = internalMutation({
  args: { ...sharedGameFields, token: v.string() },
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) throw new Error("Sign in to create a share link.");
    const recent = await ctx.db.query("sharedGames").withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId).gte("_creationTime", Date.now() - 86400000)).take(50);
    if (recent.length >= 50) throw new Error("You have created many links today. Try again tomorrow.");
    const snapshot = normalizeSharedGame(args);
    const expiresAt = Date.now() + 30 * 86400000;
    if (await ctx.db.query("sharedGames").withIndex("by_token", (q) => q.eq("token", args.token)).unique()) throw new Error("Could not create the link. Try again.");
    const id = await ctx.db.insert("sharedGames", { ...snapshot, ownerId, token: args.token, expiresAt });
    await ctx.scheduler.runAt(expiresAt, internal.sharedGames.expire, { id });
    return { token: args.token, expiresAt };
  },
});

/** Deliberately public: the random token is the capability to read this snapshot. */
export const get = query({
  args: { token: v.string() },
  returns: v.union(v.null(), v.object({ ...sharedGameFields, expiresAt: v.number() })),
  handler: async (ctx, { token }) => {
    if (!/^[a-f0-9]{40}$/.test(token)) return null;
    const game = await ctx.db.query("sharedGames").withIndex("by_token", (q) => q.eq("token", token)).unique();
    if (!game || game.expiresAt <= Date.now()) return null;
    return { mode: game.mode, title: game.title, note: game.note, name: game.name, shows: game.shows, expiresAt: game.expiresAt };
  },
});

export const revoke = mutation({
  args: { token: v.string() }, returns: v.null(),
  handler: async (ctx, { token }) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) throw new Error("Sign in to remove a link.");
    const game = await ctx.db.query("sharedGames").withIndex("by_token", (q) => q.eq("token", token)).unique();
    if (game && game.ownerId !== ownerId) throw new Error("This link belongs to someone else.");
    if (game) await ctx.db.delete(game._id);
    return null;
  },
});

export const expire = internalMutation({
  args: { id: v.id("sharedGames") }, returns: v.null(),
  handler: async (ctx, { id }) => {
    const game = await ctx.db.get(id);
    if (game && game.expiresAt <= Date.now()) await ctx.db.delete(id);
    return null;
  },
});
