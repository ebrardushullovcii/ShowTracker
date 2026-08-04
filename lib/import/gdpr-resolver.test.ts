import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedShow } from "@/lib/api/types";
import type { ParsedImportItem } from "@/lib/import/tv-time";
import {
  getVerifiedEpisodeDestination,
  selectMetadataOnlyCandidate,
  resolveGdprImportPlansWithRetry,
} from "@/lib/import/gdpr-resolver";

function item(title: string, firstAiredYear?: number): ParsedImportItem {
  return {
    title,
    mediaType: "tv",
    status: "plan_to_watch",
    watchedEpisodes: [],
    firstAiredYear,
  };
}

function show(title: string, firstAired?: string): NormalizedShow {
  return {
    id: `tmdb-tv-${title}`,
    title,
    mediaType: "tv",
    status: "ended",
    firstAired,
  };
}

test("selects an exact metadata-only title and year", () => {
  const selected = selectMetadataOnlyCandidate(item("The Strain", 2014), [
    show("The Strain", "2014-07-13"),
    show("The Strain", "2022-01-01"),
  ]);
  assert.equal(selected?.firstAired, "2014-07-13");
});

test("does not select named extensions for metadata-only entries", () => {
  const selected = selectMetadataOnlyCandidate(item("Elite"), [
    show("Elite Short Stories: Patrick", "2021-12-23"),
  ]);
  assert.equal(selected, null);
});

test("rejects low-confidence metadata-only titles", () => {
  const selected = selectMetadataOnlyCandidate(item("Baki the Grappler"), [
    show("All Elite Wrestling: Dynamite", "2019-10-02"),
  ]);
  assert.equal(selected, null);
});

test("matches a localized title through the provider original title", () => {
  const selected = selectMetadataOnlyCandidate(item("ハウルの動く城", 2004), [
    {
      ...show("Howl's Moving Castle", "2004-09-09"),
      mediaType: "movie",
      originalTitle: "ハウルの動く城",
    },
  ]);

  assert.equal(selected?.title, "Howl's Moving Castle");
});

test("matches an alternative provider title", () => {
  const selected = selectMetadataOnlyCandidate(item("365 dni", 2020), [
    {
      ...show("365 Days", "2020-02-07"),
      mediaType: "movie",
      originalTitle: "365 dni",
      alternativeTitles: ["365 Tage"],
    },
  ]);

  assert.equal(selected?.title, "365 Days");
});

test("prefers an exact external identity across localized display titles", () => {
  const source = item("The Brave");
  source.tvdbId = 437880;
  const selected = selectMetadataOnlyCandidate(source, [
    { ...show("Boundless Love", "2023-09-21"), tvdbId: 437880 },
    show("The Brave Victory", "2022-01-01"),
  ]);

  assert.equal(selected?.title, "Boundless Love");
});

test("maps a verified TVDB special to its TMDB movie destination", () => {
  assert.deepEqual(getVerifiedEpisodeDestination("4117651"), {
    mediaType: "movie",
    tmdbId: 75624,
  });
  assert.equal(getVerifiedEpisodeDestination("unknown"), undefined);
});

test("retries an empty provider resolution", async () => {
  let attempts = 0;
  const source = item("Kidnap", 2017);
  source.mediaType = "movie";
  const destination = show("Kidnap", "2017-06-16");
  destination.mediaType = "movie";

  const result = await resolveGdprImportPlansWithRetry(source, {
    baseDelayMs: 0,
    resolve: async () => {
      attempts += 1;
      return attempts < 3
        ? { plans: [], unmatched: [] }
        : { plans: [{ parsed: source, show: destination }], unmatched: [] };
    },
  });

  assert.equal(attempts, 3);
  assert.equal(result.plans[0]?.show.title, "Kidnap");
});

test("returns an empty resolution after the retry limit", async () => {
  let attempts = 0;
  const result = await resolveGdprImportPlansWithRetry(item("Unknown title"), {
    maxAttempts: 2,
    baseDelayMs: 0,
    resolve: async () => {
      attempts += 1;
      return { plans: [], unmatched: [] };
    },
  });

  assert.equal(attempts, 2);
  assert.deepEqual(result.plans, []);
});
