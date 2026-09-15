import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowActiveWatchlistItem, shouldShowWatchingWithOthersItem } from "./home-watchlist-visibility";

test("unwatched titles never appear as actively Watching", () => {
  for (const remainingEpisodes of [5, 10, 11, 23, 25]) {
    for (const mode of ["same_day", "after_airtime"] as const) {
      assert.equal(shouldShowActiveWatchlistItem({
        status: "watching", watchedEpisodes: 0, remainingEpisodes,
      }, undefined, mode), false);
    }
  }
});

test("Save for later and other sections do not enter the active queue", () => {
  for (const status of ["plan_to_watch", "paused", "dropped", "completed"]) {
    assert.equal(shouldShowActiveWatchlistItem({
      status, watchedEpisodes: 0, remainingEpisodes: 10,
    }, undefined, "same_day"), false);
  }
  for (const extra of [{ watchingWithOthers: true }, { trackingState: "upcoming" }]) {
    assert.equal(shouldShowActiveWatchlistItem({
      status: "watching", watchedEpisodes: 0, remainingEpisodes: 10, ...extra,
    }, undefined, "same_day"), false);
  }
});

test("explicit Watching still waits for a release and hides caught-up titles", () => {
  for (const watchedEpisodes of [0, 10]) {
    const item = { status: "watching", watchedEpisodes, remainingEpisodes: 0 };
    assert.equal(shouldShowActiveWatchlistItem(item, undefined, "same_day"), false);
    assert.equal(shouldShowActiveWatchlistItem({ ...item, remainingEpisodes: 5 }, {
      availableCount: 0, futureCount: 5, unavailableCount: 5,
    }, "same_day"), false);
    const releaseDay = { availableCount: 0, futureCount: 0, unavailableCount: 1 };
    assert.equal(shouldShowActiveWatchlistItem(item, releaseDay, "same_day"), watchedEpisodes > 0);
    assert.equal(shouldShowActiveWatchlistItem(item, releaseDay, "after_airtime"), false);
  }
});

test("completed titles still need new release attention to return", () => {
  const completed = { status: "completed", watchedEpisodes: 10, remainingEpisodes: 1, lastWatchedAt: 100 };
  assert.equal(shouldShowActiveWatchlistItem(completed, undefined, "same_day"), false);
  assert.equal(shouldShowActiveWatchlistItem({ ...completed, newEpisodeSignalAt: 101 }, undefined, "same_day"), true);
  assert.equal(shouldShowActiveWatchlistItem({ ...completed, remainingEpisodes: 0, newEpisodeSignalAt: 101 }, undefined, "same_day"), false);
  assert.equal(shouldShowActiveWatchlistItem({ ...completed, remainingEpisodes: 0 }, {
    availableCount: 1, futureCount: 0, unavailableCount: 0,
  }, "after_airtime"), true);
});

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
