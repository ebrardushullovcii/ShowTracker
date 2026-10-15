import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type CacheIdentity = { showId: string; normalizedTitle: string };
type BucketPayload = Pick<Doc<"scheduleCache">, "date" | "mediaType" | "episodes" | "lastUpdated">;
export const CACHE_IDENTITY_INDEX_VERSION = 1;

// Only evidence the existing cache parser accepts belongs in this index. Keep
// every provider ID/title pair, including aliases and season-title variants.
export function scheduleCacheIdentities(episodes: string): CacheIdentity[] {
  try {
    const entries = JSON.parse(episodes);
    if (!Array.isArray(entries)) return [];
    const identities = new Map<string, CacheIdentity>();
    for (const entry of entries) {
      if (typeof entry?.showId !== "string" || typeof entry?.normalizedTitle !== "string" ||
        typeof entry?.episode?.seasonNumber !== "number" || typeof entry?.episode?.episodeNumber !== "number") continue;
      const identity = { showId: entry.showId, normalizedTitle: entry.normalizedTitle };
      identities.set(JSON.stringify([identity.showId, identity.normalizedTitle]), identity);
    }
    return [...identities.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
  } catch { return []; }
}

export function encodeCacheIdentities(episodes: string) {
  return JSON.stringify(scheduleCacheIdentities(episodes).map(({ showId, normalizedTitle }) => [showId, normalizedTitle]));
}

// A malformed index must widen the read, never hide a possible match.
export function cacheIndexMayMatch(identities: string, matches: (identity: CacheIdentity) => boolean) {
  try {
    const pairs = JSON.parse(identities);
    if (!Array.isArray(pairs)) return true;
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length !== 2 || pair.some(value => typeof value !== "string")) return true;
      if (matches({ showId: pair[0], normalizedTitle: pair[1] })) return true;
    }
    return false;
  } catch { return true; }
}

export async function indexScheduleCacheBucket(ctx: MutationCtx, bucketId: Id<"scheduleCache">, payload: BucketPayload) {
  const rows = await ctx.db.query("scheduleCacheIndex")
    .withIndex("by_bucket", q => q.eq("bucketId", bucketId)).collect();
  const [row, ...duplicates] = rows;
  const fields = { bucketId, date: payload.date, mediaType: payload.mediaType, identities: encodeCacheIdentities(payload.episodes) };
  if (!row) await ctx.db.insert("scheduleCacheIndex", fields);
  else if (row.date !== fields.date || row.mediaType !== fields.mediaType || row.identities !== fields.identities) {
    await ctx.db.patch(row._id, fields);
  }
  for (const duplicate of duplicates) await ctx.db.delete(duplicate._id);
  return new TextEncoder().encode(JSON.stringify(fields)).length;
}

export async function writeScheduleCacheBucket(ctx: MutationCtx, bucketId: Id<"scheduleCache"> | null, payload: BucketPayload) {
  const fields: BucketPayload = { date: payload.date, mediaType: payload.mediaType, episodes: payload.episodes, lastUpdated: payload.lastUpdated };
  const id = bucketId ?? await ctx.db.insert("scheduleCache", fields);
  if (bucketId) await ctx.db.patch(bucketId, fields);
  await indexScheduleCacheBucket(ctx, id, fields);
  return id;
}

export async function deleteScheduleCacheBucket(ctx: MutationCtx, bucketId: Id<"scheduleCache">) {
  const rows = await ctx.db.query("scheduleCacheIndex")
    .withIndex("by_bucket", q => q.eq("bucketId", bucketId)).collect();
  for (const row of rows) await ctx.db.delete(row._id);
  await ctx.db.delete(bucketId);
}
