import { ConvexError } from "convex/values";
import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";

export function isOwner(userId: string) {
  return (process.env.SHOWTRACKER_ADMIN_USER_IDS ?? "")
    .split(",").some((id: string) => id.trim() === userId);
}

export function approvalStatus(user: Doc<"users">) {
  return user.approvalStatus ?? "approved";
}

export async function registrationRequiresApproval(ctx: QueryCtx | MutationCtx) {
  const settings = await ctx.db.query("registrationSettings")
    .withIndex("by_key", (q) => q.eq("key", "registration")).unique();
  return settings?.requireApproval ?? true;
}

// The callback runs inside account creation's transaction. Rejecting an anonymous
// signup rolls back the new user, rather than accumulating unusable guest accounts.
export async function initializeAccountAccess(
  ctx: MutationCtx,
  { userId, existingUserId, provider }: {
    userId: Id<"users">;
    existingUserId: Id<"users"> | null;
    provider: { id: string };
  },
) {
  if (existingUserId !== null) return;
  const restricted = await registrationRequiresApproval(ctx);
  if (restricted && provider.id === "anonymous") {
    throw new ConvexError("New accounts require approval. Please register with an email address.");
  }
  await ctx.db.patch(userId, {
    approvalStatus: restricted ? "pending" : "approved",
    ...(!restricted ? { approvedAt: Date.now() } : {}),
  });
}

function identityUserId(identity: UserIdentity): Id<"users"> {
  return identity.subject.split("|")[0] as Id<"users">;
}

export async function requireOwner(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !isOwner(identityUserId(identity))) {
    throw new ConvexError("Owner access required.");
  }
  const userId = identityUserId(identity);
  const [user, deletion] = await Promise.all([
    ctx.db.get(userId),
    ctx.db.query("accountDeletions").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
  ]);
  if (!user || deletion) throw new ConvexError("This account is unavailable.");
  return userId;
}

export async function requireApproved(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Sign in to continue.");
  // Signed claims avoid another users read on every existing-account request.
  // Tokens minted before this rollout belong to grandfathered accounts.
  if (identity.showtrackerApproval === "approved" || identity.showtrackerApproval === undefined) return;
  const userId = identityUserId(identity);
  const status = "db" in ctx
    ? ((await ctx.db.get(userId))?.approvalStatus ?? null)
    : await ctx.runQuery(internal.access.getApprovalStatus, { userId });
  // A waiting token can use approval immediately, before its next token refresh.
  if (status !== "approved" && !isOwner(userId)) {
    throw new ConvexError("Your account is awaiting approval.");
  }
}
