import assert from "node:assert/strict";
import test from "node:test";
import { findUnloadedRailSeason } from "./rail-season";

test("an empty season response does not keep the end of the rail loadable", () => {
  const seasons = [{ seasonNumber: 3, episodeCount: 1, episodes: [] }];
  assert.equal(findUnloadedRailSeason(seasons, 2, "next"), null);
  assert.equal(findUnloadedRailSeason(seasons, 4, "previous"), null);
});

test("the rail skips resolved empty seasons and still finds the nearest unloaded season", () => {
  const seasons = [
    { seasonNumber: 5 },
    { seasonNumber: 1 },
    { seasonNumber: 3, episodes: [] },
    { seasonNumber: 4 },
  ];
  assert.equal(findUnloadedRailSeason(seasons, 2, "next")?.seasonNumber, 4);
  assert.equal(findUnloadedRailSeason(seasons, 4, "previous")?.seasonNumber, 1);
});
