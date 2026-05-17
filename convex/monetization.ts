import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, query } from "@/convex/_generated/server";
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server";
import type { Id } from "@/convex/_generated/dataModel";
import { v } from "convex/values";

const entitlementKey = v.union(v.literal("ad_free"));
const entitlementStatus = v.union(
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("expired")
);
const entitlementProvider = v.union(
  v.literal("manual"),
  v.literal("revenuecat"),
  v.literal("clerk_billing"),
  v.literal("stripe"),
  v.literal("app_store"),
  v.literal("play_store")
);

async function getCurrentUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  return userId ? (userId as Id<"users">) : null;
}

function isEntitlementActive(args: {
  status: "active" | "past_due" | "canceled" | "expired";
  expiresAt?: number;
  currentPeriodEnd?: number;
}) {
  if (args.status !== "active") {
    return false;
  }

  const validUntil = args.expiresAt ?? args.currentPeriodEnd;
  return typeof validUntil !== "number" || validUntil > Date.now();
}

export const getViewerAccess = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      return {
        isAdFree: false,
        tier: "free",
        source: "anonymous",
        status: "none",
        revenueCatAppUserId: undefined,
      } as const;
    }

    const entitlement = await ctx.db
      .query("userEntitlements")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", userId).eq("key", "ad_free")
      )
      .unique();

    if (!entitlement || !isEntitlementActive(entitlement)) {
      return {
        isAdFree: false,
        tier: "free",
        source: "none",
        status: entitlement?.status ?? "none",
        currentPeriodEnd: entitlement?.currentPeriodEnd,
        revenueCatAppUserId: userId,
      } as const;
    }

    return {
      isAdFree: true,
      tier: "plus",
      source: entitlement.provider,
      status: entitlement.status,
      planId: entitlement.planId,
      currentPeriodEnd: entitlement.currentPeriodEnd,
      revenueCatAppUserId: userId,
    } as const;
  },
});

export const upsertUserEntitlement = internalMutation({
  args: {
    userId: v.id("users"),
    key: entitlementKey,
    status: entitlementStatus,
    provider: entitlementProvider,
    providerEntitlementId: v.optional(v.string()),
    providerProductId: v.optional(v.string()),
    providerEventId: v.optional(v.string()),
    planId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("userEntitlements")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", args.userId).eq("key", args.key)
      )
      .unique();

    const nextEntitlement = {
      key: args.key,
      status: args.status,
      provider: args.provider,
      providerEntitlementId: args.providerEntitlementId,
      providerProductId: args.providerProductId,
      providerEventId: args.providerEventId,
      planId: args.planId,
      startedAt: args.startedAt ?? existing?.startedAt ?? now,
      currentPeriodEnd: args.currentPeriodEnd,
      expiresAt: args.expiresAt,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, nextEntitlement);
      return { entitlementId: existing._id };
    }

    const entitlementId = await ctx.db.insert("userEntitlements", {
      userId: args.userId,
      ...nextEntitlement,
    });

    return { entitlementId };
  },
});

export const syncProviderEntitlement = internalMutation({
  args: {
    userIdCandidates: v.array(v.string()),
    key: entitlementKey,
    status: entitlementStatus,
    provider: entitlementProvider,
    providerEntitlementId: v.optional(v.string()),
    providerProductId: v.optional(v.string()),
    providerEventId: v.optional(v.string()),
    planId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    for (const candidate of args.userIdCandidates) {
      const userId = ctx.db.normalizeId("users", candidate);
      if (!userId) {
        continue;
      }

      const user = await ctx.db.get(userId);
      if (!user) {
        continue;
      }

      const existing = await ctx.db
        .query("userEntitlements")
        .withIndex("by_user_key", (q) =>
          q.eq("userId", userId).eq("key", args.key)
        )
        .unique();

      const now = Date.now();
      const nextEntitlement = {
        key: args.key,
        status: args.status,
        provider: args.provider,
        providerEntitlementId: args.providerEntitlementId,
        providerProductId: args.providerProductId,
        providerEventId: args.providerEventId,
        planId: args.planId,
        startedAt: args.startedAt ?? existing?.startedAt ?? now,
        currentPeriodEnd: args.currentPeriodEnd,
        expiresAt: args.expiresAt,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, nextEntitlement);
        return { ok: true, userId, entitlementId: existing._id } as const;
      }

      const entitlementId = await ctx.db.insert("userEntitlements", {
        userId,
        ...nextEntitlement,
      });
      return { ok: true, userId, entitlementId } as const;
    }

    return {
      ok: false,
      reason: "No matching Convex user id found for provider payload.",
    } as const;
  },
});
