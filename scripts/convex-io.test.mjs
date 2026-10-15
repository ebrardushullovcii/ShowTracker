import test from "node:test";
import assert from "node:assert/strict";
import { applyReleaseDeltas, exportTrackedLibrary } from "../convex/scheduleConfidence.ts";
import { getFutureUpcomingCountsForWatchlistForUser } from "../convex/schedule.ts";
import { backfillPage } from "../convex/watchedEpisodeRanges.ts";
import { toggleEpisodeWatched, unmarkEpisodesWatchedFrom, resetUserTrackingDataBatch } from "../convex/shows.ts";
import { buildWatchedEpisodeRanges } from "../lib/tracking/watched-episode-ranges.ts";
import { applyReleaseDeltaBatches } from "./schedule-confidence.mjs";
import { ScheduleCacheWriter } from "../convex/lib/scheduleCacheWriter.ts";
import { encodeCacheIdentities, writeScheduleCacheBucket, deleteScheduleCacheBucket } from "../convex/lib/scheduleCacheIndex.ts";
import { backfillPage as backfillCacheIndexPage } from "../convex/scheduleCacheIndex.ts";
import { upsertScheduleBucketInternal } from "../convex/schedule.ts";

// Counts the documents/JSON bytes the real handlers read, including nested reads.
// These are fixture document costs, not Convex billing/index/OCC measurements.
function database(seed) {
  const tables = structuredClone(seed);
  const reads = {}, bytes = {}, writesByTable = {};
  let writes = 0;
  const record = (table, rows) => {
    reads[table] = (reads[table] ?? 0) + rows.length;
    bytes[table] = (bytes[table] ?? 0) + Buffer.byteLength(JSON.stringify(rows));
    return structuredClone(rows);
  };
  const db = {
    query(table) {
      const conditions = [];
      let columns = ["_creationTime"], descending = false;
      const result = () => (tables[table] ?? []).filter(row => conditions.every(fn => fn(row)))
        .sort((a, b) => {
          for (const key of columns) {
            const x = a[key] ?? 0, y = b[key] ?? 0;
            if (x !== y) return (x < y ? -1 : 1) * (descending ? -1 : 1);
          }
          return 0;
        });
      const query = {
        withIndex(name, callback) {
          columns = name.includes("season_episode") ? ["season", "episode", "_creationTime"]
            : name.includes("date") ? ["date", "_creationTime"] : ["_creationTime"];
          const q = {};
          for (const [op, compare] of Object.entries({ eq: (a,b) => a === b, gte: (a,b) => a >= b, lte: (a,b) => a <= b })) {
            q[op] = (key, value) => { conditions.push(row => compare(row[key], value)); return q; };
          }
          callback(q); return query;
        },
        order(order) { descending = order === "desc"; return query; },
        async collect() { return record(table, result()); },
        async take(limit) { return record(table, result().slice(0, limit)); },
        async first() { return record(table, result().slice(0, 1))[0] ?? null; },
        async unique() { const rows = result(); assert.ok(rows.length <= 1); return record(table, rows)[0] ?? null; },
        async paginate({ cursor, numItems }) {
          const start = Number(cursor ?? 0), rows = result();
          return { page: record(table, rows.slice(start, start + numItems)), isDone: start + numItems >= rows.length, continueCursor: String(start + numItems) };
        },
      };
      return query;
    },
    async get(id) {
      for (const [table, rows] of Object.entries(tables)) {
        const found = rows.find(row => row._id === id);
        if (found) return record(table, [found])[0];
      }
      return null;
    },
    async patch(id, patch) {
      const table = Object.keys(tables).find(table => tables[table].some(row => row._id === id));
      const row = tables[table]?.find(row => row._id === id);
      assert.ok(row, `Missing ${id}`); Object.assign(row, patch); writes++;
      writesByTable[table] = (writesByTable[table] ?? 0) + 1;
    },
    async delete(id) {
      for (const [table, rows] of Object.entries(tables)) {
        const index = rows.findIndex(row => row._id === id);
        if (index >= 0) { rows.splice(index, 1); writes++; writesByTable[table] = (writesByTable[table] ?? 0) + 1; return; }
      }
      assert.fail(`Missing ${id}`);
    },
    async insert(table, payload) {
      const row = { ...payload, _id: `${table}-${writes}`, _creationTime: Date.now() };
      (tables[table] ??= []).push(row); writes++;
      writesByTable[table] = (writesByTable[table] ?? 0) + 1;
      return row._id;
    },
  };
  return { db, tables, reads, bytes, writesByTable, get writes() { return writes; } };
}

const token = "test-only-token";

test("production-redacted budget errors split batches and mark only committed deltas", async () => {
  const deltas = Array.from({ length: 25 }, (_, id) => ({ id }));
  const committed = [], marked = [], calls = [];
  const results = await applyReleaseDeltaBatches(deltas, {
    batchSize: 25,
    applyBatch: async batch => {
      calls.push(batch.length);
      if (batch.length > 5) throw Object.assign(new Error("Server Error"), { data: { code: "SCHEDULE_CACHE_BATCH_BUDGET" } });
      committed.push(...batch.map(delta => delta.id));
      return batch.length;
    },
    onApplied: batch => marked.push(...batch.map(delta => delta.id)),
  });
  assert.equal(calls[0], 25);
  assert.deepEqual(committed, deltas.map(delta => delta.id));
  assert.deepEqual(marked, committed);
  assert.equal(results.reduce((sum, count) => sum + count, 0), 25);
  let attempts = 0;
  await assert.rejects(() => applyReleaseDeltaBatches(deltas, {
    batchSize: 25,
    applyBatch: async () => { attempts++; throw new Error("Invalid provider evidence"); },
    onApplied: () => assert.fail("Failed deltas must not be marked applied"),
  }), /Invalid provider evidence/);
  assert.equal(attempts, 1);
});

function withCacheIndex(seed) {
  return { ...structuredClone(seed), scheduleCacheIndexState: [{ _id: "coverage", version: 1, complete: true }],
    scheduleCacheIndex: seed.scheduleCache.map((row, i) => ({ _id: `header${i}`, bucketId: row._id, date: row.date,
      mediaType: row.mediaType, identities: encodeCacheIdentities(row.episodes) })) };
}

test("identity index preserves moved dates, cross-media aliases, season titles, duplicates and unrelated entries", async () => {
  process.env.SCHEDULE_CONFIDENCE_IMPORT_TOKEN = token;
  const oldDate = "2026-10-14", date = "2026-10-15";
  const entry = (showId, normalizedTitle, seasonNumber, episodeNumber, airDate, name = "Moved") =>
    ({ showId, normalizedTitle, episode: { seasonNumber, episodeNumber, airDate, name } });
  const bucket = (id, date, mediaType, entries) => ({ _id: id, date, mediaType, episodes: JSON.stringify(entries), lastUpdated: 1 });
  const unrelated = entry("tvmaze:999", "unrelated", 2, 1, oldDate);
  const seed = { scheduleCache: [
    bucket("old", oldDate, "tv", [entry("tvmaze:1", "example", 2, 2, oldDate), unrelated]),
    bucket("alias", oldDate, "anime", [entry("anilist:456", "examplefinalseason", 2, 2, oldDate)]),
    bucket("new", date, "tv", [unrelated]), bucket("duplicate", date, "tv", [entry("tvmaze:1", "example", 2, 2, date)]),
    ...Array.from({ length: 100 }, (_, i) => bucket(`unrelated${i}`, `2025-${String(Math.floor(i / 28) + 1).padStart(2,"0")}-${String(i % 28 + 1).padStart(2,"0")}`, "tv",
      [entry(`tvmaze:${1000+i}`, `unrelated${i}`, 1, 1, "2025-01-01", "x".repeat(2048))])),
  ] };
  const args = { importToken: token, runId: "index-parity", generatedAt: Date.parse(date), deltas: [{
    canonicalKey: "tvmaze:1", title: "Example", mediaType: "tv", providerIds: { tvmazeId: 1 }, matchConfidence: "direct_id",
    releaseState: "unknown", reconciledAt: Date.parse(date), scheduleCacheMaintenance: true,
    latestReleased: { seasonNumber: 1, episodeNumber: 1, airDate: "2023-10-05", name: "Old" },
    nextScheduled: { seasonNumber: 2, episodeNumber: 2, airDate: date, name: "Moved" },
  }] };
  const before = database(seed), after = database(withCacheIndex(seed));
  await applyReleaseDeltas._handler(before, args);
  const result = await applyReleaseDeltas._handler(after, args);
  const cache = instance => instance.tables.scheduleCache.map(({ date, mediaType, episodes }) => ({ date, mediaType, episodes }));
  assert.deepEqual(cache(after), cache(before));
  assert.deepEqual(JSON.parse(after.tables.scheduleCache.find(row => row._id === "old").episodes), [unrelated]);
  assert.equal(JSON.parse(after.tables.scheduleCache.find(row => row._id === "alias").episodes).length, 0);
  assert.ok(!after.tables.scheduleCacheIndex.some(row => row.bucketId === "duplicate"));
  assert.ok(after.reads.scheduleCache < 10);
  assert.ok(after.bytes.scheduleCache + after.bytes.scheduleCacheIndex < before.bytes.scheduleCache * 0.15);
  for (const row of after.tables.scheduleCache) {
    const header = after.tables.scheduleCacheIndex.find(header => header.bucketId === row._id);
    assert.equal(header.identities, encodeCacheIdentities(row.episodes));
  }
  const replay = await applyReleaseDeltas._handler(after, args);
  assert.equal(replay.scheduleCacheBucketsWritten, 0);
  assert.ok(result.scheduleCacheIndexRowsRead > 100);
});

test("cache index sees earlier staged edits/inserts and never reloads deleted buckets", async () => {
  const date = "2026-10-15";
  const episodes = showId => JSON.stringify([{ showId, normalizedTitle: showId, episode: { seasonNumber: 1, episodeNumber: 1 } }]);
  const instance = database(withCacheIndex({ scheduleCache: [{ _id: "bucket", mediaType: "tv", date, episodes: episodes("a"), lastUpdated: 1 }] }));
  const cache = new ScheduleCacheWriter(instance);
  const [row] = await cache.readRange("tv", date, date, identity => identity.showId === "a");
  cache.write(row, { episodes: episodes("b") });
  assert.equal((await cache.readRange("tv", date, date, identity => identity.showId === "b")).length, 1);
  assert.equal((await cache.readRange("tv", date, date, identity => identity.showId === "a")).length, 0);
  cache.delete(row);
  assert.equal((await cache.readRange("tv", date, date, identity => identity.showId === "a")).length, 0);
  cache.insert({ date, mediaType: "tv", episodes: episodes("c"), lastUpdated: 2 });
  assert.equal((await cache.readRange("tv", date, date, identity => identity.showId === "c")).length, 1);
  await cache.flush();
  assert.equal(instance.tables.scheduleCache.length, 1);
  assert.equal(instance.tables.scheduleCacheIndex.length, 1);
  assert.equal(instance.tables.scheduleCacheIndex[0].identities, encodeCacheIdentities(episodes("c")));
});

test("cache index backfill activates only after full coverage and hydration maintains it atomically", async () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({ _id: `bucket${i}`, _creationTime: i,
    mediaType: "tv", date: `2026-10-${String(i+1).padStart(2,"0")}`, episodes: "[]", lastUpdated: 1 }));
  const instance = database({ scheduleCache: rows });
  const first = await backfillCacheIndexPage._handler(instance, { paginationOpts: { cursor: null, numItems: 20 } });
  assert.equal(first.isDone, false);
  assert.equal(instance.tables.scheduleCacheIndexState, undefined);
  const fallback = new ScheduleCacheWriter(instance);
  assert.equal((await fallback.readRange("tv", "2026-10-01", "2026-10-21", () => false)).length, 21);
  await backfillCacheIndexPage._handler(instance, { paginationOpts: { cursor: first.continueCursor, numItems: 20 } });
  assert.equal(instance.tables.scheduleCacheIndexState[0].complete, true);
  assert.deepEqual(instance.tables.scheduleCache, rows);
  const entries = [{ showId: "tvmaze:1", normalizedTitle: "example", episode: { seasonNumber: 1, episodeNumber: 1 } }];
  await upsertScheduleBucketInternal._handler(instance, { date: "2026-10-01", mediaType: "tv", episodes: JSON.stringify(entries), lastUpdated: 2 });
  assert.equal(instance.tables.scheduleCacheIndex.find(row => row.bucketId === "bucket0").identities, encodeCacheIdentities(JSON.stringify(entries)));
  const id = await writeScheduleCacheBucket(instance, null, { date: "2026-11-01", mediaType: "anime", episodes: JSON.stringify(entries), lastUpdated: 3 });
  assert.ok(instance.tables.scheduleCacheIndex.some(row => row.bucketId === id));
  await deleteScheduleCacheBucket(instance, id);
  assert.ok(!instance.tables.scheduleCacheIndex.some(row => row.bucketId === id));
});

test("cache budget is a structured Convex error and stops before any cache writes", async () => {
  const date = "2026-10-15";
  const instance = database({ scheduleCache: [{ _id: "bucket", mediaType: "tv", date, episodes: "[]", lastUpdated: 1 }] });
  const cache = new ScheduleCacheWriter(instance, 1);
  await assert.rejects(() => cache.readDate("tv", date), error => error.data?.code === "SCHEDULE_CACHE_BATCH_BUDGET");
  assert.equal(instance.writes, 0);
});
function librarySeed() {
  const watched = Array.from({ length: 1200 }, (_, i) => ({ _id: `w${i}`, userId: "u", showId: "s", season: 1, episode: i + 1, watchedAt: i + 1, watchCount: 2, runtime: 25, watchHistory: [i + 1, i + 2], sourceEpisodeId: `import:episode:${i}` }));
  return {
    watchedEpisodes: watched,
    shows: [{ _id: "s", title: "Long running", mediaType: "tv", tmdbId: 1, totalEpisodes: 1201, releasedEpisodes: 1201, status: "returning", lastUpdated: 1 }],
    userShows: [{ _id: "us", userId: "u", showId: "s", status: "watching", watchedEpisodesCount: 1200, lastWatchedAt: 1200, addedAt: 1 }],
    feedProjections: [{ _id: "p", userId: "u", showId: "s", userShowId: "us", title: "Long running", mediaType: "tv", tmdbId: 1, totalEpisodes: 1201, status: "watching", watchedEpisodesCount: 1200, lastWatchedAt: 1200, remainingEpisodes: 1, updatedAt: 1, scheduleProjectionUpdatedAt: 1 }],
  };
}

test("export preserves all 128 anchors while eliminating watched-history reads", async () => {
  process.env.SCHEDULE_CONFIDENCE_IMPORT_TOKEN = token;
  const seed = librarySeed();
  const before = database(seed);
  const args = { importToken: token, paginationOpts: { cursor: null, numItems: 100 } };
  const expected = await exportTrackedLibrary._handler(before, args);
  seed.userShows[0].watchedEpisodeRanges = buildWatchedEpisodeRanges(seed.watchedEpisodes);
  const after = database(seed);
  const actual = await exportTrackedLibrary._handler(after, args);
  assert.deepEqual(actual, expected);
  assert.equal(before.reads.watchedEpisodes, 128);
  assert.equal(after.reads.watchedEpisodes ?? 0, 0);
  const sum = db => Object.values(db.bytes).reduce((a,b) => a + b, 0);
  assert.ok(sum(after) < sum(before) * 0.06);
  console.log(JSON.stringify({ exportFixtureBytesBefore: sum(before), exportFixtureBytesAfter: sum(after) }));
});

test("future-count output stays identical with exact watched checks and no full-history reads", async () => {
  const seed = librarySeed();
  const date = new Date().toISOString().slice(0,10);
  seed.userScheduleProjectionWindows = [{ userId: "u", scheduleStartDate: "2000-01-01", scheduleEndDate: "2099-12-31", projectionUpdatedAt: 2, updatedAt: 2 }];
  seed.userScheduleEvents = [1200,1201].map(episodeNumber => ({ _id: `e${episodeNumber}`, userId: "u", showId: "s", userShowId: "us", feedProjectionId: "p", date, routeId: "tmdb:tv:1", mediaType: "tv", sourceMediaType: "tv", sourceProvider: "tvmaze", showTitle: "Long running", seasonNumber: 1, episodeNumber, episodeName: `Chapter ${episodeNumber}`, airDate: `${date}T00:00:00.000Z`, airtimeMs: Date.parse(date), sourceMatchesTracked: true }));
  const args = { userId: "u", startDate: date, endDate: date };
  const before = database(seed);
  const expected = await getFutureUpcomingCountsForWatchlistForUser._handler(before, args);
  seed.userShows[0].watchedEpisodeRanges = buildWatchedEpisodeRanges(seed.watchedEpisodes);
  const after = database(seed);
  const actual = await getFutureUpcomingCountsForWatchlistForUser._handler(after, args);
  assert.deepEqual(actual, expected);
  assert.equal(actual[0].availableCount, 1);
  assert.equal(before.reads.watchedEpisodes, 1200);
  assert.equal(after.reads.watchedEpisodes ?? 0, 0);
  const sum = db => Object.values(db.bytes).reduce((a,b) => a+b,0);
  assert.ok(sum(after) < sum(before) * 0.02);
  console.log(JSON.stringify({ countsFixtureBytesBefore: sum(before), countsFixtureBytesAfter: sum(after) }));
});

test("bounded backfill changes only missing coordinate summaries and resumes safely", async () => {
  const instance = database(librarySeed());
  const before = structuredClone(instance.tables);
  const args = { paginationOpts: { cursor: null, numItems: 1 } };
  const result = await backfillPage._handler(instance, args);
  assert.equal(result.historyRows, 1200);
  assert.equal(result.updated, 1);
  assert.equal(instance.tables.userShows[0].watchedEpisodeRanges, "[[1,1,1200]]");
  const { watchedEpisodeRanges, ...rest } = instance.tables.userShows[0];
  assert.deepEqual(rest, before.userShows[0]);
  assert.deepEqual(instance.tables.watchedEpisodes, before.watchedEpisodes);
  assert.equal((await backfillPage._handler(instance, args)).historyRows, 0);
  assert.equal(instance.writes, 1);
});

test("real watch, rewatch, unwatch and multi-episode undo keep coordinate summaries current", async () => {
  const seed = librarySeed();
  seed.userShows[0].watchedEpisodeRanges = buildWatchedEpisodeRanges(seed.watchedEpisodes);
  const instance = database(seed);
  const ctx = { ...instance, auth: { getUserIdentity: async () => ({ subject: "u|session" }) } };
  const show = { title: "Long running", mediaType: "tv", tmdbId: 1, totalEpisodes: 1201, releasedEpisodes: 1201, totalSeasons: 1, status: "returning" };
  await toggleEpisodeWatched._handler(ctx, { show, season: 1, episode: 500, action: "toggle" });
  assert.equal(instance.tables.userShows[0].watchedEpisodeRanges, "[[1,1,499],[1,501,1200]]");
  await toggleEpisodeWatched._handler(ctx, { show, season: 1, episode: 500, action: "toggle" });
  assert.equal(instance.tables.userShows[0].watchedEpisodeRanges, "[[1,1,1200]]");
  await toggleEpisodeWatched._handler(ctx, { show, season: 1, episode: 500, action: "rewatch" });
  assert.equal(instance.tables.userShows[0].watchedEpisodeRanges, "[[1,1,1200]]");
  await unmarkEpisodesWatchedFrom._handler(ctx, { show, season: 1, episode: 1190 });
  assert.equal(instance.tables.userShows[0].watchedEpisodeRanges, "[[1,1,1189]]");
  assert.equal(instance.tables.userShows[0].watchedEpisodesCount, 1189);
});

test("a partial account reset invalidates summaries before deleting history", async () => {
  const seed = librarySeed();
  seed.userShows[0].watchedEpisodeRanges = buildWatchedEpisodeRanges(seed.watchedEpisodes);
  const instance = database(seed);
  await resetUserTrackingDataBatch._handler(instance, { userId: "u", limit: 10 });
  assert.equal(instance.tables.userShows[0].watchedEpisodeRanges, undefined);
  assert.equal(instance.tables.watchedEpisodes.length, 1190);
});

test("release batching preserves completed/auto-paused reactivation and manual pause/drop intent", async () => {
  process.env.SCHEDULE_CONFIDENCE_IMPORT_TOKEN = token;
  const seed = librarySeed();
  const states = ["completed", "auto_paused", "paused", "dropped", "plan_to_watch"];
  seed.userShows = states.map((state, i) => ({ _id: `us${i}`, userId: `u${i}`, showId: "s", status: state === "auto_paused" ? "paused" : state,
    autoPausedAt: state === "auto_paused" ? 1 : undefined, addedAt: 1, lastWatchedAt: 1, watchedEpisodesCount: state === "plan_to_watch" ? 0 : 1200,
    watchingWithOthers: true, watchingWithNames: ["Companion"] }));
  seed.feedProjections = [];
  const instance = database(seed);
  await applyReleaseDeltas._handler(instance, { importToken: token, runId: "status-parity", generatedAt: Date.now(), deltas: [{
    canonicalKey: "tmdb:tv:1", showId: "s", title: "Long running", mediaType: "tv", providerIds: { tmdbId: 1 },
    matchConfidence: "direct_id", releaseState: "available_now", releasedEpisodes: 1201, totalEpisodes: 1201,
    latestReleased: { seasonNumber: 1, episodeNumber: 1201, name: "New release", airDate: new Date().toISOString() }, reconciledAt: Date.now(),
  }] });
  assert.deepEqual(instance.tables.userShows.map(row => row.status), ["watching", "watching", "paused", "dropped", "plan_to_watch"]);
  for (const row of instance.tables.userShows) assert.deepEqual(row.watchingWithNames, ["Companion"]);
});

test("25 release deltas share bucket reads and writes with identical final cache and idle replay", async () => {
  process.env.SCHEDULE_CONFIDENCE_IMPORT_TOKEN = token;
  const date = "2026-10-15", oldDate = "2026-10-14";
  const entries = Array.from({ length: 25 }, (_, i) => ({ showId: `tvmaze:${i+1}`, normalizedTitle: `series${i+1}`, episode: { seasonNumber: 1, episodeNumber: 2, name: "Moved", airDate: oldDate } }));
  const unrelated = { showId: "tvmaze:999", normalizedTitle: "unrelated", episode: { seasonNumber: 3, episodeNumber: 1, airDate: oldDate } };
  const seed = { scheduleCache: [
    { _id: "old", date: oldDate, mediaType: "tv", episodes: JSON.stringify([...entries, unrelated]), lastUpdated: 1 },
    { _id: "new", date, mediaType: "tv", episodes: "[]", lastUpdated: 1 },
  ] };
  const deltas = entries.map((entry,i) => ({ canonicalKey: entry.showId, title: `Series ${i+1}`, mediaType: "tv", providerIds: { tvmazeId: i+1 }, matchConfidence: "direct_id", releaseState: "unknown", reconciledAt: Date.parse(date), scheduleCacheMaintenance: true, nextScheduled: { ...entry.episode, airDate: date } }));
  const base = { importToken: token, runId: "io-test", generatedAt: Date.parse(date) };
  const before = database(seed);
  for (const delta of deltas) await applyReleaseDeltas._handler(before, { ...base, deltas: [delta] });
  const after = database(seed);
  const result = await applyReleaseDeltas._handler(after, { ...base, deltas });
  const cache = instance => instance.tables.scheduleCache.map(({ date, mediaType, episodes }) => ({ date, mediaType, episodes }));
  assert.deepEqual(cache(after), cache(before));
  assert.equal(after.reads.scheduleCache, 2);
  assert.equal(result.scheduleCacheBucketsWritten, 2);
  assert.equal(before.reads.scheduleCache, 50);
  assert.equal(before.writesByTable.scheduleCache, 50);
  assert.ok(after.bytes.scheduleCache < before.bytes.scheduleCache * 0.06);
  const repeated = await applyReleaseDeltas._handler(after, { ...base, deltas });
  assert.equal(repeated.scheduleCacheBucketsWritten, 0);
  assert.deepEqual(JSON.parse(after.tables.scheduleCache[0].episodes), [unrelated]);
  console.log(JSON.stringify({ cacheFixtureBytesBefore: before.bytes.scheduleCache, cacheFixtureBytesAfter: result.scheduleCacheBytesRead, writesBefore: before.writesByTable.scheduleCache, writesAfter: result.scheduleCacheBucketsWritten }));
});
