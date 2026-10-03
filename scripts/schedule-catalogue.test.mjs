import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { initDb, upsertLibraryItem, rememberProviderCatalogue,
  buildFreshCatalogueCachePrunes, isUnconfirmedProviderPlaceholder } from "./schedule-confidence.mjs";

const now = Date.UTC(2026, 9, 1, 14);
const episode = (seasonNumber, episodeNumber) => ({ seasonNumber, episodeNumber });
const tmdb = {
  sourceProvider: "tmdb", providerShowId: "tmdb:tv:72649", mediaType: "tv",
  mode: "season_bounds", validEpisodes: [episode(31, 1), episode(31, 2)],
  exactSeasonNumbers: [31], seasonEpisodeCounts: [{ seasonNumber: 31, episodeCount: 2 }],
};
const tvmaze = {
  sourceProvider: "tvmaze", providerShowId: "tvmaze:1", mediaType: "tv",
  mode: "exact_episode_set", validEpisodes: [episode(31, 1), episode(31, 2), episode(31, 3)],
};

test("only unannounced TVMaze placeholders absent from a hydrated canonical season are rejected", () => {
  const row = { source_provider: "tvmaze", season_number: 31, episode_number: 3, name: "TBA ... While Eating Spicy Wings" };
  assert.equal(isUnconfirmedProviderPlaceholder(row, tmdb), true);
  assert.equal(isUnconfirmedProviderPlaceholder({ ...row, name: "A real guest" }, tmdb), false);
  assert.equal(isUnconfirmedProviderPlaceholder({ ...row, name: "Episode 3" }, tmdb), false);
  assert.equal(isUnconfirmedProviderPlaceholder({ ...row, episode_number: 2 }, tmdb), false);
  assert.equal(isUnconfirmedProviderPlaceholder(row, { ...tmdb, exactSeasonNumbers: [] }), false);
  assert.equal(isUnconfirmedProviderPlaceholder(row, null), false);
  assert.equal(isUnconfirmedProviderPlaceholder({ ...row, source_provider: "tmdb" }, tmdb), false);
});

test("fresh catalogue prunes Convex orphans even after SQLite provider rows were already removed", () => {
  const db = new DatabaseSync(":memory:");
  try {
    initDb(db);
    upsertLibraryItem(db, { showId: "hot", title: "Hot Ones", mediaType: "tv", status: "watching", tmdbId: 72649, tvmazeId: 1 });
    upsertLibraryItem(db, { showId: "delicious", title: "Delicious in Dungeon", mediaType: "tv", status: "watching", tmdbId: 207784, tvmazeId: 69046 });
    rememberProviderCatalogue(db, { show_id: "hot" }, tmdb, now);
    rememberProviderCatalogue(db, { show_id: "hot" }, tvmaze, now);
    rememberProviderCatalogue(db, { show_id: "delicious" }, { ...tvmaze, providerShowId: "tvmaze:69046", validEpisodes: [episode(1, 24)] }, now);
    const cached = [{ date: "2026-10-01", mediaType: "tv", episodes: JSON.stringify([
      { showId: "tvmaze:1", episode: { ...episode(31, 3), name: "TBA While Eating Spicy Wings" } },
      { showId: "tvmaze:1", episode: { ...episode(31, 2), name: "Willem Dafoe" } },
      { showId: "tvmaze:69046", episode: { ...episode(2, 1), name: "Episode 1" } },
      { showId: "tvmaze:999", episode: { ...episode(2, 1), name: "Unrelated" } },
    ]) }];
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM provider_events").get().n, 0);
    const deltas = buildFreshCatalogueCachePrunes(db, cached, now);
    assert.equal(deltas.length, 2);
    assert.deepEqual(deltas.map((delta) => delta.scheduleCacheProviderPrunes[0].episodes), [
      [{ ...episode(31, 3), name: "TBA While Eating Spicy Wings", airDate: "2026-10-01" }],
      [{ ...episode(2, 1), name: "Episode 1", airDate: "2026-10-01" }],
    ]);
    assert.ok(deltas.every((delta) => delta.scheduleCachePruneOnly && delta.releaseState === "unknown" && delta.releasedEpisodes === undefined));
    assert.deepEqual(buildFreshCatalogueCachePrunes(db, cached, now + 37 * 3600000), []);
    assert.deepEqual(buildFreshCatalogueCachePrunes(db, [{ ...cached[0], episodes: "invalid" }], now), []);
    db.prepare("INSERT INTO runs (id, mode, started_at) VALUES (?, ?, ?)").run("fresh-failed-pass", "local", now + 1000);
    assert.deepEqual(buildFreshCatalogueCachePrunes(db, cached, now + 2000), [], "Previous-pass evidence cannot authorize deletion after a failed fetch");
    rememberProviderCatalogue(db, { show_id: "delicious" }, { ...tvmaze, providerShowId: "tvmaze:69046", validEpisodes: [] }, now + 2000);
    assert.deepEqual(buildFreshCatalogueCachePrunes(db, cached, now + 2000), [], "An empty response cannot renew stale proof");
    rememberProviderCatalogue(db, { show_id: "delicious" }, { ...tvmaze, providerShowId: "tvmaze:69046", validEpisodes: [episode(1, 24)] }, now + 2000);
    assert.equal(buildFreshCatalogueCachePrunes(db, cached, now + 2000).length, 1, "Only the successfully refreshed provider can prune in this pass");
  } finally { db.close(); }
});

test("fresh same-date provider aliases preserve canonical cache coordinates without protecting orphans", () => {
  const db = new DatabaseSync(":memory:");
  try {
    initDb(db);
    upsertLibraryItem(db, { showId: "apothecary", title: "The Apothecary Diaries", mediaType: "tv", status: "watching", tmdbId: 220542, tvmazeId: 67017 });
    const canonicalCatalogue = { ...tmdb, providerShowId: "tmdb:tv:220542",
      validEpisodes: [episode(1, 49)], exactSeasonNumbers: [1],
      seasonEpisodeCounts: [{ seasonNumber: 1, episodeCount: 49 }] };
    const timingCatalogue = { ...tvmaze, providerShowId: "tvmaze:67017", validEpisodes: [episode(3, 1)] };
    for (const catalogue of [canonicalCatalogue, timingCatalogue]) {
      rememberProviderCatalogue(db, { show_id: "apothecary" }, catalogue, now);
    }
    const insert = db.prepare(`INSERT INTO provider_events
      (id, source_provider, provider_show_id, title, normalized_title, media_type,
       season_number, episode_number, name, air_date, air_timestamp, tmdb_id, tvmaze_id, inserted_at)
      VALUES (?, ?, ?, 'The Apothecary Diaries', 'theapothecarydiaries', 'tv', ?, ?, ?, ?, ?, 220542, 67017, ?)`);
    insert.run("canonical", "tmdb", "tmdb:tv:220542", 1, 49, "Locusts", "2026-10-02", Date.UTC(2026, 9, 2), now);
    insert.run("timing", "tvmaze", "tvmaze:67017", 3, 1, "Locusts", "2026-10-02T13:30:00+00:00", Date.UTC(2026, 9, 2, 13, 30), now);
    const entry = { showId: "tvmaze:67017", episode: { ...episode(1, 49), name: "Locusts", airDate: "2026-10-02T13:30:00+00:00" } };
    const cache = (date = "2026-10-02", value = entry) => [{ date, mediaType: "tv", episodes: JSON.stringify([value]) }];
    assert.deepEqual(buildFreshCatalogueCachePrunes(db, cache(), now), [], "TVMaze airtime with verified TMDB numbering is valid");
    assert.equal(buildFreshCatalogueCachePrunes(db, cache("2026-10-01"), now).length, 1, "A moved date is not protected");
    assert.equal(buildFreshCatalogueCachePrunes(db, cache("2026-10-02", { ...entry, episode: episode(1, 50) }), now).length, 1, "An unrelated canonical coordinate is not protected");
    db.prepare("UPDATE provider_events SET name = 'Different episode' WHERE id = 'timing'").run();
    assert.equal(buildFreshCatalogueCachePrunes(db, cache(), now).length, 1, "Different names and numbers do not establish an alias");
    db.prepare("UPDATE provider_events SET name = 'Locusts', inserted_at = ? WHERE id = 'timing'").run(now - 37 * 3600000);
    assert.equal(buildFreshCatalogueCachePrunes(db, cache(), now).length, 1, "Old raw provider rows cannot establish a fresh alias");
    db.prepare("UPDATE provider_events SET inserted_at = ? WHERE id = 'timing'").run(now);
    db.prepare("DELETE FROM provider_catalogues WHERE provider_show_id = 'tmdb:tv:220542'").run();
    assert.equal(buildFreshCatalogueCachePrunes(db, cache(), now).length, 1, "Both provider catalogues must be fresh");
    rememberProviderCatalogue(db, { show_id: "apothecary" }, canonicalCatalogue, now);
    rememberProviderCatalogue(db, { show_id: "apothecary" }, { ...timingCatalogue, validEpisodes: [episode(3, 2)] }, now);
    assert.equal(buildFreshCatalogueCachePrunes(db, cache(), now).length, 1, "A removed own-provider episode is still pruned");
  } finally { db.close(); }
});
