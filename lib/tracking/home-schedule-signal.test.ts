import assert from "node:assert/strict";
import test from "node:test";

import { isHomeScheduleSignalActionable } from "../../convex/lib/homeScheduleSignalPolicy";

test("rejects a pre-watch provider-season alias for a caught-up show", () => {
  const augustThirdRelease = Date.parse("2026-08-03T18:00:00+02:00");
  const watchedAfterRelease = Date.parse("2026-08-06T19:29:01+02:00");

  assert.equal(
    isHomeScheduleSignalActionable(
      {
        lastWatchedAt: watchedAfterRelease,
        remainingEpisodes: 0,
      },
      augustThirdRelease
    ),
    false
  );
});

test("keeps a new release after the last watch actionable", () => {
  const lastWatchedAt = Date.parse("2026-08-06T19:29:01+02:00");
  const augustTenthRelease = Date.parse("2026-08-10T18:00:00+02:00");

  assert.equal(
    isHomeScheduleSignalActionable(
      {
        lastWatchedAt,
        remainingEpisodes: 0,
      },
      augustTenthRelease
    ),
    true
  );
});

test("keeps an older skipped episode actionable when released backlog remains", () => {
  const oldRelease = Date.parse("2026-08-03T18:00:00+02:00");
  const laterWatch = Date.parse("2026-08-06T19:29:01+02:00");

  assert.equal(
    isHomeScheduleSignalActionable(
      {
        lastWatchedAt: laterWatch,
        remainingEpisodes: 1,
      },
      oldRelease
    ),
    true
  );
});

test("preserves legacy matching when the projection has no remaining count", () => {
  assert.equal(
    isHomeScheduleSignalActionable(
      {
        lastWatchedAt: 200,
      },
      100
    ),
    true
  );
});
