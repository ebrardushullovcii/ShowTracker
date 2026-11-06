import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { approvalStatus, isOwner, registrationRequiresApproval, requireOwner } from "./lib/accessPolicy";

const statusValidator = v.union(v.literal("pending"), v.literal("approved"));
const userSummary = v.object({
  id: v.id("users"), email: v.optional(v.string()), name: v.optional(v.string()),
  isAnonymous: v.boolean(), createdAt: v.number(), status: statusValidator,
  approvedAt: v.optional(v.number()),
});

export const current = query({
  args: {},
  returns: v.union(v.null(), v.object({
    status: statusValidator, email: v.optional(v.string()), isAdmin: v.boolean(),
  })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const owner = isOwner(userId);
    return { status: owner ? "approved" as const : approvalStatus(user), email: user.email, isAdmin: owner };
  },
});

export const registrationPolicy = query({
  args: {}, returns: v.object({ requireApproval: v.boolean() }),
  handler: async (ctx) => ({ requireApproval: await registrationRequiresApproval(ctx) }),
});

export const getApprovalStatus = internalQuery({
  args: { userId: v.id("users") }, returns: v.union(statusValidator, v.null()),
  handler: async (ctx, { userId }): Promise<"pending" | "approved" | null> => {
    const user = await ctx.db.get(userId);
    return user ? approvalStatus(user) : null;
  },
});

export const listUsers = query({
  args: { filter: v.union(v.literal("all"), v.literal("pending")), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(userSummary), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, { filter, paginationOpts }) => {
    await requireOwner(ctx);
    const users = filter === "pending"
      ? ctx.db.query("users").withIndex("by_approvalStatus", (q) => q.eq("approvalStatus", "pending"))
      : ctx.db.query("users");
    const result = await users.order("desc").paginate({
      ...paginationOpts, numItems: Math.min(Math.max(paginationOpts.numItems, 1), 50),
      maximumBytesRead: 256_000,
    });
    return { isDone: result.isDone, continueCursor: result.continueCursor,
      page: result.page.map((user) => ({
        id: user._id, email: user.email, name: user.name, isAnonymous: user.isAnonymous ?? false,
        createdAt: user._creationTime, status: approvalStatus(user), approvedAt: user.approvedAt,
      })),
    };
  },
});

export const approveUser = mutation({
  args: { userId: v.id("users") }, returns: v.null(),
  handler: async (ctx, { userId }) => {
    const ownerId = await requireOwner(ctx);
    const [user, deletion] = await Promise.all([
      ctx.db.get(userId),
      ctx.db.query("accountDeletions").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ]);
    if (!user || deletion) throw new ConvexError("This account is unavailable.");
    if (approvalStatus(user) === "approved") return null;
    await ctx.db.patch(userId, { approvalStatus: "approved", approvedAt: Date.now(), approvedBy: ownerId });
    return null;
  },
});

export const setRegistrationPolicy = mutation({
  args: { requireApproval: v.boolean() }, returns: v.null(),
  handler: async (ctx, { requireApproval }) => {
    const ownerId = await requireOwner(ctx);
    const settings = await ctx.db.query("registrationSettings")
      .withIndex("by_key", (q) => q.eq("key", "registration")).unique();
    const fields = { requireApproval, updatedAt: Date.now(), updatedBy: ownerId };
    if (settings) await ctx.db.patch(settings._id, fields);
    else await ctx.db.insert("registrationSettings", { key: "registration", ...fields });
    return null;
  },
});
