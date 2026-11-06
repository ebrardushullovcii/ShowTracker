"use node";
import { action } from "./lib/approvedFunctions";
import { randomBytes } from "node:crypto";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { sharedGameFields } from "./shareValidators";

export const create = action({
  args: sharedGameFields,
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args): Promise<{ token: string; expiresAt: number }> => {
    if (!(await getAuthUserId(ctx))) throw new ConvexError("Sign in to create a share link.");
    return await ctx.runMutation(internal.sharedGames.createSnapshot, { ...args, token: randomBytes(20).toString("hex") });
  },
});
