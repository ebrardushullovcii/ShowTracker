import assert from "node:assert/strict";
import test from "node:test";
import { resolveManualTrackingStatus } from "./initial-status";
import { shouldShowActiveWatchlistItem } from "./home-watchlist-visibility";

test("new and legacy zero-progress Watching requests save as Planned", () => {
  for (const mediaType of ["tv", "anime"] as const) {
    assert.equal(resolveManualTrackingStatus("watching", mediaType, 0), "plan_to_watch");
    assert.equal(resolveManualTrackingStatus("plan_to_watch", mediaType, 0), "plan_to_watch");
    assert.equal(resolveManualTrackingStatus("watching", mediaType, 1), "watching");
  }
});

test("explicit shared mode, movies and other manual statuses retain their meaning", () => {
  assert.equal(resolveManualTrackingStatus("watching", "tv", 0, true), "watching");
  assert.equal(resolveManualTrackingStatus("watching", "movie", 0), "watching");
  for (const status of ["paused", "dropped", "completed"] as const) {
    assert.equal(resolveManualTrackingStatus(status, "tv", 0), status);
  }
});

test("the active queue starts with real progress and empties when the last watch is undone", () => {
  const item = { status: "watching", watchedEpisodes: 0, remainingEpisodes: 11 };
  assert.equal(shouldShowActiveWatchlistItem(item, undefined, "same_day"), false);
  assert.equal(shouldShowActiveWatchlistItem({ ...item, watchedEpisodes: 1, remainingEpisodes: 10 }, undefined, "same_day"), true);
  assert.equal(shouldShowActiveWatchlistItem({ ...item, status: "plan_to_watch" }, undefined, "same_day"), false);
});
