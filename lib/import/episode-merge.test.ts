import assert from "node:assert/strict";
import test from "node:test";
import { mergeCanonicalImportEpisodes } from "@/lib/import/episode-merge";

test("combines split provider parts without manufacturing a rewatch", () => {
  const merged = mergeCanonicalImportEpisodes(
    {
      season: 4,
      episode: 27,
      providerEpisodeId: "tmdb-episode:461496",
      sourceEpisodeId: "part-one",
      watchedAt: 100,
    },
    {
      season: 4,
      episode: 27,
      providerEpisodeId: "tmdb-episode:461496",
      sourceEpisodeId: "7659644",
      watchedAt: 200,
    }
  );

  assert.equal(merged.watchCount, undefined);
  assert.equal(merged.watchedAt, 200);
  assert.equal(merged.watchHistory, undefined);
  assert.deepEqual(merged.sourceEpisodeIds, ["part-one", "7659644"]);
});

test("pairs real rewatches across split provider parts", () => {
  const merged = mergeCanonicalImportEpisodes(
    {
      season: 6,
      episode: 13,
      providerEpisodeId: "tmdb-episode:finale",
      sourceEpisodeId: "part-one",
      watchCount: 2,
      watchHistory: [100, 300],
    },
    {
      season: 6,
      episode: 13,
      providerEpisodeId: "tmdb-episode:finale",
      sourceEpisodeId: "4432653",
      watchCount: 2,
      watchHistory: [200, 400],
    }
  );

  assert.equal(merged.watchCount, 2);
  assert.deepEqual(merged.watchHistory, [200, 400]);
  assert.equal(merged.watchedAt, 400);
});
