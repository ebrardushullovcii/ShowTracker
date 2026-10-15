import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { CACHE_IDENTITY_INDEX_VERSION, cacheIndexMayMatch, scheduleCacheIdentities,
  writeScheduleCacheBucket, deleteScheduleCacheBucket, type CacheIdentity } from "./scheduleCacheIndex";

type MediaType = "tv" | "anime";
type Payload = Pick<Doc<"scheduleCache">, "date" | "mediaType" | "episodes" | "lastUpdated">;
type Bucket = Payload & { key: string; id?: Id<"scheduleCache"> };
type Range = { start: string; end: string };

function nextDay(date: string, offset = 1) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

// One transaction owns the working copy. Later deltas see earlier changes, but
// Convex only reads each covered bucket once and writes the final result once.
export class ScheduleCacheWriter {
  private rows = new Map<string, Bucket>();
  private originals = new Map<string, Payload>();
  private covered: Record<MediaType, Range[]> = { tv: [], anime: [] };
  private pending = new Set<string>();
  private deleted = new Set<Id<"scheduleCache">>();
  private indexRows = new Map<Id<"scheduleCache">, Doc<"scheduleCacheIndex">>();
  private indexCovered: Record<MediaType, Range[]> = { tv: [], anime: [] };
  private indexReady?: Promise<boolean>;
  private dateOrders = new Map<string, string[]>();
  readonly metrics = { bucketsRead: 0, bytesRead: 0, bucketsWritten: 0, bytesWritten: 0, indexRowsRead: 0, indexBytesRead: 0 };

  constructor(private ctx: MutationCtx, private maxReadBytes = Infinity) {}

  private checkBudget() {
    if (this.metrics.bytesRead + this.metrics.indexBytesRead > this.maxReadBytes) {
      throw new ConvexError({ code: "SCHEDULE_CACHE_BATCH_BUDGET" });
    }
  }

  private remember(row: Doc<"scheduleCache">) {
    this.metrics.bucketsRead++;
    this.metrics.bytesRead += new TextEncoder().encode(JSON.stringify(row)).length;
    this.checkBudget();
    if (this.rows.has(row._id) || this.deleted.has(row._id)) return;
    this.rows.set(row._id, { ...row, key: row._id, id: row._id });
    this.originals.set(row._id, row);
  }

  private missingRanges(covered: Range[], start: string, end: string) {
    let cursor = start;
    const missing: Range[] = [];
    for (const range of covered) {
      if (range.end < cursor) continue;
      if (range.start > end) break;
      if (range.start > cursor) missing.push({ start: cursor, end: nextDay(range.start, -1) });
      if (range.end >= cursor) cursor = nextDay(range.end);
      if (cursor > end) break;
    }
    if (cursor <= end) missing.push({ start: cursor, end });
    return missing;
  }

  private cover(covered: Range[], start: string, end: string) {
    const ranges = [...covered, { start, end }].sort((a, b) => a.start.localeCompare(b.start));
    const merged: Range[] = [];
    for (const range of ranges) {
      const previous = merged[merged.length - 1];
      if (previous && range.start <= nextDay(previous.end)) {
        if (range.end > previous.end) previous.end = range.end;
      } else merged.push({ ...range });
    }
    return merged;
  }

  async readRange(mediaType: MediaType, start: string, end: string, matches?: (identity: CacheIdentity) => boolean): Promise<Bucket[]> {
    if (matches) {
      this.indexReady ??= this.ctx.db.query("scheduleCacheIndexState").first()
        .then(state => state?.complete === true && state.version === CACHE_IDENTITY_INDEX_VERSION);
      if (await this.indexReady) return this.readMatchingRange(mediaType, start, end, matches);
    }

    for (const range of this.missingRanges(this.covered[mediaType], start, end)) {
      const rows = await this.ctx.db.query("scheduleCache")
        .withIndex("by_type_date", q => range.start === range.end
          ? q.eq("mediaType", mediaType).eq("date", range.start)
          : q.eq("mediaType", mediaType).gte("date", range.start).lte("date", range.end))
        .take(4097);
      if (rows.length > 4096) throw new ConvexError({ code: "SCHEDULE_CACHE_BATCH_BUDGET" });
      const orders = new Map<string, string[]>();
      for (const row of rows) {
        this.remember(row);
        const key = `${row.mediaType}:${row.date}`;
        const ids = orders.get(key) ?? [];
        ids.push(row._id);
        orders.set(key, ids);
      }
      for (const [key, ids] of orders) this.dateOrders.set(key, ids);
    }
    this.covered[mediaType] = this.cover(this.covered[mediaType], start, end);
    return [...this.rows.values()].filter(row => row.mediaType === mediaType && row.date >= start && row.date <= end);
  }

  private async readMatchingRange(mediaType: MediaType, start: string, end: string, matches: (identity: CacheIdentity) => boolean) {
    for (const range of this.missingRanges(this.indexCovered[mediaType], start, end)) {
      const headers = await this.ctx.db.query("scheduleCacheIndex")
        .withIndex("by_type_date", q => q.eq("mediaType", mediaType).gte("date", range.start).lte("date", range.end))
        .take(4097);
      if (headers.length > 4096) throw new ConvexError({ code: "SCHEDULE_CACHE_BATCH_BUDGET" });
      for (const header of headers) {
        this.indexRows.set(header.bucketId, header);
        this.metrics.indexRowsRead++;
        this.metrics.indexBytesRead += new TextEncoder().encode(JSON.stringify(header)).length;
      }
      this.checkBudget();
    }
    this.indexCovered[mediaType] = this.cover(this.indexCovered[mediaType], start, end);
    for (const header of this.indexRows.values()) {
      if (header.mediaType !== mediaType || header.date < start || header.date > end ||
        this.rows.has(header.bucketId) || this.deleted.has(header.bucketId) || !cacheIndexMayMatch(header.identities, matches)) continue;
      const row = await this.ctx.db.get(header.bucketId);
      if (row) this.remember(row);
    }
    // Include inserts and edits made by preceding deltas, even if their stored
    // index header did not match. Deletes cannot be loaded again from headers.
    return [...this.rows.values()].filter(row => row.mediaType === mediaType && row.date >= start && row.date <= end &&
      scheduleCacheIdentities(row.episodes).some(matches));
  }

  async readDate(mediaType: MediaType, date: string) {
    await this.readRange(mediaType, date, date);
    // A matching index read may load a later duplicate first. Exact-date writes
    // must still choose the original database index order, then collapse extras.
    const existing = (this.dateOrders.get(`${mediaType}:${date}`) ?? [])
      .map(id => this.rows.get(id)).filter((row): row is Bucket => Boolean(row));
    const inserted = [...this.rows.values()].filter(row => !row.id && row.mediaType === mediaType && row.date === date);
    return [...existing, ...inserted];
  }

  write(row: Bucket, patch: Partial<Payload>) {
    this.rows.set(row.key, { ...row, ...patch });
    this.pending.add(row.key);
  }

  insert(payload: Payload) {
    const key = `new:${payload.mediaType}:${payload.date}`;
    this.rows.set(key, { ...payload, key });
    this.pending.add(key);
  }

  delete(row: Bucket) {
    this.rows.delete(row.key);
    this.pending.delete(row.key);
    if (row.id) this.deleted.add(row.id);
  }

  async flush() {
    for (const id of this.deleted) {
      await deleteScheduleCacheBucket(this.ctx, id);
      this.metrics.bucketsWritten++;
    }
    for (const key of this.pending) {
      const row = this.rows.get(key)!;
      const original = this.originals.get(key);
      if (original?.episodes === row.episodes) continue;
      const payload: Payload = { date: row.date, mediaType: row.mediaType, episodes: row.episodes, lastUpdated: row.lastUpdated };
      await writeScheduleCacheBucket(this.ctx, row.id ?? null, payload);
      this.metrics.bucketsWritten++;
      this.metrics.bytesWritten += new TextEncoder().encode(JSON.stringify(payload)).length;
    }
    return this.metrics;
  }
}
