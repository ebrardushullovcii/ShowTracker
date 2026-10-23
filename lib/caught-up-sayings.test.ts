import assert from "node:assert/strict";
import test from "node:test";
import { CAUGHT_UP_SAYINGS, pickCaughtUpSaying } from "@/lib/caught-up-sayings";

test("the caught-up saying stays the same all day", () => {
  const morning = new Date(2026, 9, 23, 0, 5);
  const night = new Date(2026, 9, 23, 23, 55);
  assert.deepEqual(pickCaughtUpSaying(morning), pickCaughtUpSaying(night));
});

test("the caught-up saying changes from one day to the next", () => {
  const today = new Date(2026, 9, 23, 12);
  const tomorrow = new Date(2026, 9, 24, 12);
  assert.notDeepEqual(pickCaughtUpSaying(today), pickCaughtUpSaying(tomorrow));
});

test("every caught-up saying names its source", () => {
  for (const saying of CAUGHT_UP_SAYINGS) {
    assert.ok(saying.line.trim().length > 0);
    assert.ok(saying.source.trim().length > 0);
  }
});
