import assert from "node:assert/strict";
import test from "node:test";
import { getScheduleDayDistance } from "./schedule-day-distance";

test("counts calendar days between local date keys", () => {
  assert.equal(getScheduleDayDistance("2026-09-29", "2026-09-29"), 0);
  assert.equal(getScheduleDayDistance("2026-09-29", "2026-09-30"), 1);
  assert.equal(getScheduleDayDistance("2026-09-29", "2026-10-04"), 5);
  assert.equal(getScheduleDayDistance("2026-09-30", "2026-09-29"), -1);
});

test("crosses month, year and daylight-saving boundaries without drift", () => {
  assert.equal(getScheduleDayDistance("2026-12-31", "2027-01-01"), 1);
  assert.equal(getScheduleDayDistance("2026-10-24", "2026-10-26"), 2);
  assert.equal(getScheduleDayDistance("2026-03-28", "2026-03-30"), 2);
});

test("ignores the server's UTC day when the viewer is already on the next local day", () => {
  // 01:30 on Tue Sep 29 in UTC+2 is still Mon Sep 28 in UTC; Wednesday is tomorrow locally.
  const localTodayKey = "2026-09-29";
  assert.equal(getScheduleDayDistance(localTodayKey, "2026-09-30"), 1);
});

test("rejects malformed keys", () => {
  assert.equal(getScheduleDayDistance("2026-9-29", "2026-09-30"), null);
  assert.equal(getScheduleDayDistance("", "2026-09-30"), null);
});
