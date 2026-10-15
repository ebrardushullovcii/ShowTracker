import test from "node:test";
import assert from "node:assert/strict";
import { applyReleaseDeltas } from "../convex/scheduleConfidence.ts";

test("dated cache-only prunes preserve other providers, moved dates, and all tracking", async () => {
  process.env.SCHEDULE_CONFIDENCE_IMPORT_TOKEN = "test-only-token";
  const make = (showId) => ({ showId, normalizedTitle: "test", episode: { seasonNumber: 2, episodeNumber: 1 } });
  const rows = [
    { _id: "stale", date: "2026-10-01", mediaType: "tv", episodes: JSON.stringify([make("tvmaze:69046"), make("tmdb:tv:207784"), make("tvmaze:999")]) },
    { _id: "moved", date: "2026-10-02", mediaType: "tv", episodes: JSON.stringify([make("tvmaze:69046")]) },
  ];
  const bucketReads = [];
  const headers = [];
  let writes = 0;
  const db = {
    query(table) {
      assert.ok(["scheduleCache", "scheduleCacheIndex"].includes(table), "Cache-only delta must not read shows or user history");
      const conditions = [];
      return {
        withIndex(name, callback) {
          assert.equal(name, table === "scheduleCache" ? "by_type_date" : "by_bucket");
          const q = { eq(key, value) { conditions.push([key, value]); return q; } };
          callback(q); return this;
        },
        async take(limit) {
          assert.ok(limit <= 4097, "Cache reads remain bounded");
          bucketReads.push(conditions.find(([key]) => key === "date")[1]);
          return rows.filter((row) => conditions.every(([key, value]) => row[key] === value)).slice(0, limit);
        },
        async collect() { return headers.filter(row => conditions.every(([key, value]) => row[key] === value)); },
      };
    },
    async patch(id, patch) { const row = rows.find(row => row._id === id) ?? headers.find(row => row._id === id); assert.ok(row); if (rows.includes(row)) writes++; Object.assign(row, patch); },
    async insert(table, fields) { assert.equal(table, "scheduleCacheIndex"); const id = `header${headers.length}`; headers.push({ ...fields, _id: id }); return id; },
  };
  const args = { importToken: "test-only-token", runId: "catalogue-test", generatedAt: Date.UTC(2026, 9, 1, 14), deltas: [{
    canonicalKey: "schedule-cache:catalogue:tvmaze:69046", title: "Delicious in Dungeon", mediaType: "tv",
    providerIds: { tmdbId: 207784, tvmazeId: 69046 }, matchConfidence: "direct_id", releaseState: "unknown",
    reconciledAt: Date.UTC(2026, 9, 1, 14), scheduleCachePruneOnly: true,
    scheduleCacheProviderPrunes: [{ sourceProvider: "tvmaze", providerShowId: "tvmaze:69046",
      episodes: [{ seasonNumber: 2, episodeNumber: 1, airDate: "2026-10-01" }] }],
  }] };
  const first = await applyReleaseDeltas._handler({ db }, args);
  assert.equal(first.scheduleCacheRowsUpdated, 1);
  assert.equal(first.matchedShows, 0);
  assert.deepEqual(JSON.parse(rows[0].episodes).map((entry) => entry.showId), ["tmdb:tv:207784", "tvmaze:999"]);
  assert.equal(JSON.parse(rows[1].episodes)[0].showId, "tvmaze:69046");
  assert.deepEqual(bucketReads, ["2026-10-01"]);
  const repeat = await applyReleaseDeltas._handler({ db }, args);
  assert.equal(repeat.scheduleCacheRowsUpdated, 0);
  assert.equal(writes, 1);
  assert.equal(headers.length, 1);
  assert.equal(headers[0].bucketId, "stale");
});
