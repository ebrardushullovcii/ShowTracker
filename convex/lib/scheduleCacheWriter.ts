import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";

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
  readonly metrics = { bucketsRead: 0, bytesRead: 0, bucketsWritten: 0, bytesWritten: 0 };

  constructor(private ctx: MutationCtx, private maxReadBytes = Infinity) {}

  async readRange(mediaType: MediaType, start: string, end: string): Promise<Bucket[]> {
    let cursor = start;
    const missing: Range[] = [];
    for (const range of this.covered[mediaType]) {
      if (range.end < cursor) continue;
      if (range.start > end) break;
      if (range.start > cursor) missing.push({ start: cursor, end: nextDay(range.start, -1) });
      if (range.end >= cursor) cursor = nextDay(range.end);
      if (cursor > end) break;
    }
    if (cursor <= end) missing.push({ start: cursor, end });

    for (const range of missing) {
      const rows = await this.ctx.db.query("scheduleCache")
        .withIndex("by_type_date", q => range.start === range.end
          ? q.eq("mediaType", mediaType).eq("date", range.start)
          : q.eq("mediaType", mediaType).gte("date", range.start).lte("date", range.end))
        .take(4097);
      if (rows.length > 4096) throw new Error("Schedule cache range exceeds batch budget");
      for (const row of rows) {
        this.rows.set(row._id, { ...row, key: row._id, id: row._id });
        this.originals.set(row._id, row);
        this.metrics.bucketsRead++;
        this.metrics.bytesRead += new TextEncoder().encode(JSON.stringify(row)).length;
      }
      if (this.metrics.bytesRead > this.maxReadBytes) {
        throw new ConvexError({ code: "SCHEDULE_CACHE_BATCH_BUDGET" });
      }
    }
    const ranges = [...this.covered[mediaType], { start, end }].sort((a, b) => a.start.localeCompare(b.start));
    const merged: Range[] = [];
    for (const range of ranges) {
      const previous = merged[merged.length - 1];
      if (previous && range.start <= nextDay(previous.end)) {
        if (range.end > previous.end) previous.end = range.end;
      } else merged.push({ ...range });
    }
    this.covered[mediaType] = merged;
    return [...this.rows.values()].filter(row => row.mediaType === mediaType && row.date >= start && row.date <= end);
  }

  readDate(mediaType: MediaType, date: string) { return this.readRange(mediaType, date, date); }

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
      await this.ctx.db.delete(id);
      this.metrics.bucketsWritten++;
    }
    for (const key of this.pending) {
      const row = this.rows.get(key)!;
      const original = this.originals.get(key);
      if (original?.episodes === row.episodes) continue;
      const payload: Payload = { date: row.date, mediaType: row.mediaType, episodes: row.episodes, lastUpdated: row.lastUpdated };
      if (row.id) await this.ctx.db.patch(row.id, payload);
      else await this.ctx.db.insert("scheduleCache", payload);
      this.metrics.bucketsWritten++;
      this.metrics.bytesWritten += new TextEncoder().encode(JSON.stringify(payload)).length;
    }
    return this.metrics;
  }
}
