import assert from "node:assert/strict";
import { test } from "node:test";
import { findWidgetNextEpisodes, widgetEpisodeRelease, type WidgetReleaseContext } from "./widget-episode";

const context: WidgetReleaseContext = {
  day: "2026-11-24",
  timeZone: "Europe/Belgrade",
  airtimeMode: "after_airtime",
  now: Date.parse("2026-11-24T17:00:00Z"),
};

test("the next episode follows saved episode keys across seasons", () => {
  const first = { seasonNumber: 1, episodeNumber: 1, airDate: "2026-10-01" };
  const skipped = { seasonNumber: 1, episodeNumber: 2, airDate: "2026-10-08" };
  const newer = { seasonNumber: 2, episodeNumber: 1, airDate: "2026-11-01" };
  const episodes = [newer, skipped, first];
  assert.equal(findWidgetNextEpisodes(episodes, new Set(["1:1", "2:1"]), context, 3)[0], skipped);
  assert.equal(findWidgetNextEpisodes(episodes, new Set(["1:1", "1:2"]), context, 3)[0], newer);
  assert.deepEqual(findWidgetNextEpisodes([...episodes, skipped], new Set(), context, 2), [first, skipped]);
});

test("release timing honors same-day and after-airtime modes", () => {
  const episode = { seasonNumber: 1, episodeNumber: 2, airDate: "2026-11-24T19:00:00Z" };
  assert.equal(findWidgetNextEpisodes([episode], new Set(), context, 3)[0], undefined);
  assert.equal(findWidgetNextEpisodes([episode], new Set(), { ...context, airtimeMode: "same_day" }, 3)[0], episode);
  assert.equal(widgetEpisodeRelease({ ...episode, airDate: "2026-11-23T23:30:00Z" }, context)?.day, "2026-11-24");
});

test("an unknown date, future episode or special cannot be the next available episode", () => {
  const episodes = [
    { seasonNumber: 0, episodeNumber: 1, airDate: "2026-01-01" },
    { seasonNumber: 1, episodeNumber: 1 },
    { seasonNumber: 1, episodeNumber: 2, airDate: "2026-11-25" },
  ];
  assert.equal(findWidgetNextEpisodes(episodes, new Set(), context, 3)[0], undefined);
});
