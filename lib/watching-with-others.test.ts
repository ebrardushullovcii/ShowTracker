import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_WATCHING_WITH_NAME_LENGTH,
  areWatchingWithNamesEqual,
  isTrackingStatusSelectionUnchanged,
  normalizeWatchingWithNames,
} from "./watching-with-others";

test("normalizes, deduplicates, and bounds companion names", () => {
  const longName = "x".repeat(MAX_WATCHING_WITH_NAME_LENGTH + 10);

  assert.deepEqual(
    normalizeWatchingWithNames([
      " Vigan ",
      "vigan",
      "Gent",
      "  ",
      longName,
      "Erza",
      "Spoxx",
      "Ignored sixth name",
    ]),
    ["Vigan", "Gent", "x".repeat(MAX_WATCHING_WITH_NAME_LENGTH), "Erza", "Spoxx"]
  );
});

test("allows companion mode without names", () => {
  assert.deepEqual(normalizeWatchingWithNames(), []);
  assert.deepEqual(normalizeWatchingWithNames([" ", "\t"]), []);
});

test("compares companion names by value for no-op projection refreshes", () => {
  assert.equal(areWatchingWithNamesEqual(["Vigan", "Gent"], ["Vigan", "Gent"]), true);
  assert.equal(areWatchingWithNamesEqual(undefined, []), true);
  assert.equal(areWatchingWithNamesEqual(["Vigan", "Gent"], ["Gent", "Vigan"]), false);
});

test("regular Watching is a real change while companion mode is active", () => {
  assert.equal(isTrackingStatusSelectionUnchanged("watching", "watching", true), false);
  assert.equal(isTrackingStatusSelectionUnchanged("watching", "watching", false), true);
  assert.equal(isTrackingStatusSelectionUnchanged("paused", "watching", false), false);
});
