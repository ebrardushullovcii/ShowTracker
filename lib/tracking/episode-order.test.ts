import assert from "node:assert/strict";
import test from "node:test";
import { isEpisodeAtOrAfter, parseEpisodeKey } from "./episode-order";

test("unwatching from an episode covers it, the rest of its season, and later seasons", () => {
  const anchor = { season: 2, episode: 5 };
  assert.equal(isEpisodeAtOrAfter({ season: 2, episode: 5 }, anchor), true);
  assert.equal(isEpisodeAtOrAfter({ season: 2, episode: 6 }, anchor), true);
  assert.equal(isEpisodeAtOrAfter({ season: 3, episode: 1 }, anchor), true);
  assert.equal(isEpisodeAtOrAfter({ season: 2, episode: 4 }, anchor), false);
  assert.equal(isEpisodeAtOrAfter({ season: 1, episode: 9 }, anchor), false);
});

test("specials stay outside the main run", () => {
  assert.equal(isEpisodeAtOrAfter({ season: 0, episode: 3 }, { season: 1, episode: 1 }), false);
  assert.equal(isEpisodeAtOrAfter({ season: 1, episode: 1 }, { season: 0, episode: 1 }), false);
  assert.equal(isEpisodeAtOrAfter({ season: 0, episode: 3 }, { season: 0, episode: 2 }), true);
});

test("episode keys parse only when both parts are numbers", () => {
  assert.deepEqual(parseEpisodeKey("3:12"), { season: 3, episode: 12 });
  assert.equal(parseEpisodeKey("3:"), null);
  assert.equal(parseEpisodeKey("rewatch"), null);
});
