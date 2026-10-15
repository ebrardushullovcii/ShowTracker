import test from "node:test";
import assert from "node:assert/strict";
import { applyReleaseDeltas, exportTrackedLibrary } from "../convex/scheduleConfidence.ts";
import { getFutureUpcomingCountsForWatchlistForUser } from "../convex/schedule.ts";
import { backfillPage } from "../convex/watchedEpisodeRanges.ts";
import { toggleEpisodeWatched, unmarkEpisodesWatchedFrom, resetUserTrackingDataBatch } from "../convex/shows.ts";
import { buildWatchedEpisodeRanges } from "../lib/tracking/watched-episode-ranges.ts";

// Counts the documents/JSON bytes the real handlers read, including nested reads.
// These are fixture document costs, not Convex billing/index/OCC measurements.
function database(seed) {
  const tables = structuredClone(seed);
  const reads = {}, bytes = {};
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
      const row = Object.values(tables).flat().find(row => row._id === id);
      assert.ok(row, `Missing ${id}`); Object.assign(row, patch); writes++;
    },
    async delete(id) {
      for (const rows of Object.values(tables)) {
        const index = rows.findIndex(row => row._id === id);
        if (index >= 0) { rows.splice(index, 1); writes++; return; }
      }
      assert.fail(`Missing ${id}`);
    },
    async insert(table, payload) {
      const row = { ...payload, _id: `${table}-${writes}`, _creationTime: Date.now() };
      (tables[table] ??= []).push(row); writes++; return row._id;
    },
  };
  return { db, tables, reads, bytes, get writes() { return writes; } };
}

const token = "test-only-token";
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
  assert.equal(before.writes, 50);
  assert.ok(after.bytes.scheduleCache < before.bytes.scheduleCache * 0.06);
  const repeated = await applyReleaseDeltas._handler(after, { ...base, deltas });
  assert.equal(repeated.scheduleCacheBucketsWritten, 0);
  assert.deepEqual(JSON.parse(after.tables.scheduleCache[0].episodes), [unrelated]);
  console.log(JSON.stringify({ cacheFixtureBytesBefore: before.bytes.scheduleCache, cacheFixtureBytesAfter: result.scheduleCacheBytesRead, writesBefore: before.writes, writesAfter: result.scheduleCacheBucketsWritten }));
});
