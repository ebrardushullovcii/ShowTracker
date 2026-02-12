import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password, Anonymous],
});

export const checkPasswordAccount = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const raw = args.email.trim();
    if (!raw) {
      return { exists: false, matchedEmail: "" } as const;
    }

    const candidates = raw.toLowerCase() === raw ? [raw] : [raw, raw.toLowerCase()];

    for (const candidate of candidates) {
      const account = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", candidate)
        )
        .unique();

      if (account) {
        return { exists: true, matchedEmail: candidate } as const;
      }
    }

    return { exists: false, matchedEmail: raw.toLowerCase() } as const;
  },
});
