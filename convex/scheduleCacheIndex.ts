import { internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { CACHE_IDENTITY_INDEX_VERSION, indexScheduleCacheBucket } from "./lib/scheduleCacheIndex";

// Explicit, resumable deployment migration. All cache writers maintain the index
// atomically, including while this walk is running. Reads keep their old scan
// until the final page commits the coverage marker.
export const backfillPage = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({ continueCursor: v.string(), isDone: v.boolean(), scanned: v.number(), bucketBytes: v.number(), indexBytes: v.number() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("scheduleCache").paginate({ ...args.paginationOpts, numItems: 20 });
    let bucketBytes = 0, indexBytes = 0;
    for (const row of page.page) {
      bucketBytes += new TextEncoder().encode(JSON.stringify(row)).length;
      indexBytes += await indexScheduleCacheBucket(ctx, row._id, row);
    }
    if (page.isDone) {
      const state = await ctx.db.query("scheduleCacheIndexState").first();
      const fields = { version: CACHE_IDENTITY_INDEX_VERSION, complete: true };
      if (state) await ctx.db.patch(state._id, fields);
      else await ctx.db.insert("scheduleCacheIndexState", fields);
    }
    return { continueCursor: page.continueCursor, isDone: page.isDone, scanned: page.page.length, bucketBytes, indexBytes };
  },
});
