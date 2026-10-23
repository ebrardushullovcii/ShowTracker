import assert from "node:assert/strict";
import test from "node:test";
import { CAUGHT_UP_SAYINGS, pickCaughtUpSaying } from "@/lib/caught-up-sayings";

test("the caught-up saying covers the whole list", () => {
  assert.equal(pickCaughtUpSaying(() => 0), CAUGHT_UP_SAYINGS[0]);
  assert.equal(pickCaughtUpSaying(() => 0.9999), CAUGHT_UP_SAYINGS[CAUGHT_UP_SAYINGS.length - 1]);
});

test("the caught-up saying varies between visits", () => {
  const picks = new Set(
    Array.from({ length: CAUGHT_UP_SAYINGS.length }, (_, index) =>
      pickCaughtUpSaying(() => (index + 0.5) / CAUGHT_UP_SAYINGS.length).line
    )
  );
  assert.equal(picks.size, CAUGHT_UP_SAYINGS.length);
});

test("every caught-up saying names its source", () => {
  for (const saying of CAUGHT_UP_SAYINGS) {
    assert.ok(saying.line.trim().length > 0);
    assert.ok(saying.source.trim().length > 0);
  }
});
