import assert from "node:assert/strict";
import test from "node:test";
import { buildWatchedEpisodeRanges, readWatchedEpisodeRanges, watchedEpisodesFromRanges, watchedEpisodeAnchorsFromRanges } from "./watched-episode-ranges";

test("ranges preserve sparse, special, absolute, duplicate and out-of-catalogue coordinates", () => {
  const rows = [
    { season: 2, episode: 104 }, { season: 0, episode: 2 },
    { season: 1, episode: 1 }, { season: 1, episode: 3 },
    { season: 1, episode: 3 }, { season: 2, episode: 103 },
    { season: 8, episode: 900 },
  ];
  const expected = [...rows].sort((a, b) => a.season - b.season || a.episode - b.episode);
  const ranges = readWatchedEpisodeRanges(buildWatchedEpisodeRanges(rows))!;
  assert.deepEqual([...watchedEpisodesFromRanges(ranges)], expected);
  assert.deepEqual(watchedEpisodeAnchorsFromRanges(ranges, 4), expected.reverse().slice(0, 4));
});

test("long histories stay small and unwatching an interior episode preserves the gap", () => {
  const rows = Array.from({ length: 1200 }, (_, i) => ({ season: 1, episode: i + 1 }));
  const encoded = buildWatchedEpisodeRanges(rows);
  assert.ok(encoded.length < 20);
  assert.equal([...watchedEpisodesFromRanges(readWatchedEpisodeRanges(encoded)!)].length, 1200);
  const afterUnwatch = rows.filter(row => row.episode !== 500);
  const decoded = [...watchedEpisodesFromRanges(readWatchedEpisodeRanges(buildWatchedEpisodeRanges(afterUnwatch))!)];
  assert.deepEqual(decoded, afterUnwatch);
  assert.deepEqual(watchedEpisodeAnchorsFromRanges(readWatchedEpisodeRanges(encoded)!, 128), rows.reverse().slice(0, 128));
});

test("missing or invalid summaries fall back; an empty history is authoritative", () => {
  assert.equal(readWatchedEpisodeRanges(), null);
  for (const invalid of ["bad", "null", "{}", "[[1,9,1]]", "[[1,1,2.5]]"]) assert.equal(readWatchedEpisodeRanges(invalid), null);
  assert.deepEqual(readWatchedEpisodeRanges(buildWatchedEpisodeRanges([])), []);
});
