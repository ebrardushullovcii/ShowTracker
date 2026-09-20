import assert from "node:assert/strict";
import test from "node:test";
import { confirmConflict, LIMITS, runReleaseTiming } from "./release-timing.mjs";
import { applyConfirmedReleasePage } from "../convex/scheduleConfidence.ts";

const now = Date.parse("2026-09-20T18:00:00Z");
// Choose UTC tomorrow and a confirmed earlier timestamp within the same day.
const tomorrow = new Date(now + 86400000).toISOString().slice(0, 10);
const stamp = now - 3600000;
const candidate = { tmdb_id: 94664, tvmaze_id: 52279, season_number: 3, episode_number: 13, air_timestamp: stamp };
const episode = { seasonNumber: 3, episodeNumber: 13, name: "The Diary" };
const tmdb = { events: [{ ...episode, airDate: tomorrow, providers: { tmdbId: 94664 } }], metadata: { releasedEpisodes: 59, totalEpisodes: 61 } };
const tvmaze = { events: [{ ...episode, airDate: new Date(stamp).toISOString(), providers: { tvmazeId: 52279 } }], metadata: { releasedEpisodes: 60 } };

test("fresh confirmation requires exact identity, non-generic name, first future and one episode count", () => {
  assert.ok(confirmConflict(candidate, tmdb, tvmaze, now));
  assert.equal(confirmConflict({ ...candidate, tvmaze_id: 1 }, tmdb, tvmaze, now), null);
  assert.equal(confirmConflict(candidate, tmdb, { ...tvmaze, metadata: { releasedEpisodes: 80 } }, now), null);
  assert.equal(confirmConflict(candidate, tmdb, { ...tvmaze, events: [{ ...tvmaze.events[0], name: "Another episode" }] }, now), null);
  assert.equal(confirmConflict(candidate, tmdb, tvmaze, stamp - 1), null);
  assert.equal(confirmConflict(candidate, { ...tmdb, events: [{ ...tmdb.events[0], airDate: "2099-09-28" }] }, tvmaze, now), null);
  assert.equal(confirmConflict(candidate, { ...tmdb, events: [{ ...tmdb.events[0], episodeNumber: 12 }, ...tmdb.events] }, tvmaze, now), null);
  assert.equal(LIMITS.pagesPerRun, 4);
  assert.equal(LIMITS.mutationCallsPerDay, 64);
});

function makeDb(users = 55) {
  const show = { _id: "show", mediaType: "tv", tmdbId: 94664, tvmazeId: 52279, title: "Mushoku Tensei", releasedEpisodes: 59, totalEpisodes: 61, lastUpdated: now };
  const other = { showId: "tmdb:tv:999", normalizedTitle: "unrelated", episode: { seasonNumber: 1, episodeNumber: 1 } };
  const tables = { shows: [show], userShows: [], feedProjections: [], userScheduleEvents: [], scheduleCache: [
    { _id: "old", date: tomorrow, mediaType: "tv", episodes: JSON.stringify([other, { showId: "tvmaze:52279", episode: { seasonNumber: 3, episodeNumber: 13 } }]) },
  ] };
  for (let i = 0; i < users; i++) {
    const status = ["watching", "paused", "dropped", "plan_to_watch", "completed"][i % 5];
    tables.userShows.push({ _id: `us${i}`, userId: `u${i}`, showId: "show", status, watchedEpisodesCount: status === "plan_to_watch" ? 0 : 59,
      watchedTotalCount: 70, watchedRuntimeMinutes: 1400, addedAt: now - 86400000, lastWatchedAt: now - 86400000,
      watchingWithOthers: i === 0, watchingWithNames: i === 0 ? ["Friend"] : undefined });
    tables.userScheduleEvents.push({ _id: `event${i}`, userId: `u${i}`, routeId: "tmdb:tv:94664", date: tomorrow,
      seasonNumber: 3, episodeNumber: 13, airtimeMs: Date.parse(tomorrow), sameTrackedShowDayKey: `tmdb:tv:94664:${tomorrow}` });
  }
  let reads = 0;
  const db = {
    query(table) {
      assert.ok(table in tables, `Unexpected table read ${table}`);
      let conditions = [];
      const select = () => tables[table].filter(r => conditions.every(([key, value]) => r[key] === value));
      return {
        withIndex(_name, callback) { const q = { eq(k, v) { conditions.push([k, v]); return q; } }; callback(q); return this; },
        async take(n) { assert.ok(n <= 17); const rows = select().slice(0, n); reads += rows.length; return rows; },
        async unique() { const rows = select(); assert.ok(rows.length <= 1); reads += rows.length; return rows[0] ?? null; },
        async paginate({ cursor, numItems }) { assert.equal(numItems, 25); const rows = select(); const at = Number(cursor ?? 0); const page = rows.slice(at, at + numItems); reads += page.length; return { page, isDone: at + numItems >= rows.length, continueCursor: String(at + numItems) }; },
      };
    },
    async patch(id, patch) { const row = Object.values(tables).flat().find(r => r._id === id); assert.ok(row); Object.assign(row, patch); },
    async insert(table, value) { tables[table].push({ _id: `${table}${tables[table].length}`, ...value }); },
  };
  return { db, tables, get reads() { return reads; } };
}

test("bounded mutation paginates growing users, is replay-safe, and never reads watch history", async (t) => {
  t.mock.method(Date, "now", () => now);
  process.env.SCHEDULE_CONFIDENCE_IMPORT_TOKEN = "test-only-token";
  const fake = makeDb();
  const before = structuredClone(fake.tables.userShows);
  const correction = confirmConflict(candidate, tmdb, tvmaze, now);
  const args = { importToken: "test-only-token", tmdbId: 94664, tvmazeId: 52279, correction };
  const results = [];
  do { results.push(await applyConfirmedReleasePage._handler({ db: fake.db }, args)); } while (!results.at(-1).done);
  assert.deepEqual(results.map(r => r.users), [25, 25, 5]);
  assert.ok(fake.reads < 240, `Unexpected read growth: ${fake.reads}`);
  for (let i = 0; i < before.length; i++) {
    const after = fake.tables.userShows[i];
    for (const key of ["watchedEpisodesCount", "watchedTotalCount", "watchedRuntimeMinutes", "watchingWithOthers", "watchingWithNames"])
      assert.deepEqual(after[key], before[i][key]);
    if (["paused", "dropped", "plan_to_watch"].includes(before[i].status)) assert.equal(after.status, before[i].status);
  }
  assert.equal(JSON.parse(fake.tables.scheduleCache.find(r => r._id === "old").episodes)[0].showId, "tmdb:tv:999");
  assert.equal(fake.tables.userScheduleEvents.every(e => e.airtimeMs === stamp), true);
  assert.deepEqual(fake.tables.feedProjections[0].watchingWithNames, ["Friend"]);
  assert.equal(fake.tables.feedProjections[0].watchingWithOthers, true);
  assert.deepEqual(await applyConfirmedReleasePage._handler({ db: fake.db }, args), { done: true, users: 0, writes: 0, replay: true });
  await assert.rejects(() => applyConfirmedReleasePage._handler({ db: fake.db }, { ...args, importToken: "wrong" }));
});

test("ambiguous or oversized projection buckets refuse correction", async (t) => {
  t.mock.method(Date, "now", () => now);
  process.env.SCHEDULE_CONFIDENCE_IMPORT_TOKEN = "test-only-token";
  const args = { importToken: "test-only-token", tmdbId: 94664, tvmazeId: 52279,
    correction: confirmConflict(candidate, tmdb, tvmaze, now) };
  const duplicate = makeDb(1);
  duplicate.tables.userScheduleEvents.push({ ...duplicate.tables.userScheduleEvents[0], _id: "duplicate", date: new Date(stamp).toISOString().slice(0, 10) });
  await assert.rejects(() => applyConfirmedReleasePage._handler({ db: duplicate.db }, args), /Duplicate episode/);
  const oversized = makeDb(1);
  oversized.tables.scheduleCache[0].episodes = " ".repeat(128001);
  await assert.rejects(() => applyConfirmedReleasePage._handler({ db: oversized.db }, args), /intraday budget/);
});

test("idle VPS pass has zero provider or Convex work", async () => {
  const result = await runReleaseTiming({ dbPath: ".schedule-confidence/validation.sqlite", dryRun: true, now });
  assert.equal(result.providerAttempts, 0);
  assert.equal(result.mutationCalls, 0);
  assert.equal(result.writes, 0);
});
