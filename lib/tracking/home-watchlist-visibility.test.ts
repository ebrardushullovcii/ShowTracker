import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowWatchingWithOthersItem } from "./home-watchlist-visibility";

const bleachCaughtUp = {
  status: "watching",
  watchingWithOthers: true,
  remainingEpisodes: 0,
  lastWatchedAt: 200,
  newEpisodeSignalAt: null,
};

test("hides a caught-up shared watch with no actionable episode", () => {
  const futureOnlyCounts = {
    availableCount: 0,
    futureCount: 5,
    unavailableCount: 5,
  };

  assert.equal(
    shouldShowWatchingWithOthersItem(
      bleachCaughtUp,
      futureOnlyCounts,
      "same_day",
    ),
    false,
  );
  assert.equal(
    shouldShowWatchingWithOthersItem(
      bleachCaughtUp,
      futureOnlyCounts,
      "after_airtime",
    ),
    false,
  );
});

test("keeps an unfinished shared watch visible unless all remaining episodes are future", () => {
  const unfinished = {
    ...bleachCaughtUp,
    remainingEpisodes: 11,
  };

  assert.equal(
    shouldShowWatchingWithOthersItem(unfinished, undefined, "same_day"),
    true,
  );
  assert.equal(
    shouldShowWatchingWithOthersItem(
      unfinished,
      { availableCount: 0, futureCount: 11, unavailableCount: 11 },
      "same_day",
    ),
    false,
  );
});

test("shows a caught-up shared watch again when a new episode is actionable", () => {
  const sameDayRelease = {
    availableCount: 0,
    futureCount: 0,
    unavailableCount: 1,
  };
  const releasedEpisode = {
    availableCount: 1,
    futureCount: 0,
    unavailableCount: 1,
  };

  assert.equal(
    shouldShowWatchingWithOthersItem(
      bleachCaughtUp,
      sameDayRelease,
      "same_day",
    ),
    true,
  );
  assert.equal(
    shouldShowWatchingWithOthersItem(
      bleachCaughtUp,
      sameDayRelease,
      "after_airtime",
    ),
    false,
  );
  assert.equal(
    shouldShowWatchingWithOthersItem(
      bleachCaughtUp,
      releasedEpisode,
      "same_day",
    ),
    true,
  );
  assert.equal(
    shouldShowWatchingWithOthersItem(
      bleachCaughtUp,
      releasedEpisode,
      "after_airtime",
    ),
    true,
  );
});

test("does not let a signal alone revive a caught-up shared watch", () => {
  assert.equal(
    shouldShowWatchingWithOthersItem(
      { ...bleachCaughtUp, newEpisodeSignalAt: 201 },
      { availableCount: 0, futureCount: 0, unavailableCount: 0 },
      "same_day",
    ),
    false,
  );
});

test("requires both Watching status and shared-watch mode", () => {
  assert.equal(
    shouldShowWatchingWithOthersItem(
      { ...bleachCaughtUp, remainingEpisodes: 1, watchingWithOthers: false },
      undefined,
      "same_day",
    ),
    false,
  );
  assert.equal(
    shouldShowWatchingWithOthersItem(
      { ...bleachCaughtUp, remainingEpisodes: 1, status: "paused" },
      undefined,
      "same_day",
    ),
    false,
  );
});
