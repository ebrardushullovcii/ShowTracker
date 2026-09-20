import assert from "node:assert/strict";
import test from "node:test";
import { applyConfirmedRelease, confirmedReleaseFloor, isConfirmedReleaseValid } from "./confirmed-release";

const now = Date.parse("2026-09-20T18:00:00Z");
const proof = { seasonNumber: 3, episodeNumber: 13, name: "The Diary", tmdbAirDate: "2026-09-21",
  airTimestamp: Date.parse("2026-09-20T15:00:00Z"), releasedEpisodes: 60, verifiedAt: now };
test("only the verified canonical episode and unchanged provider date get corrected", () => {
  const episode = { seasonNumber: 3, episodeNumber: 13, airDate: "2026-09-21" };
  assert.equal(applyConfirmedRelease(episode, proof, now).airDate, "2026-09-20T15:00:00.000Z");
  for (const other of [{ ...episode, episodeNumber: 14 }, { ...episode, seasonNumber: 2 }, { ...episode, airDate: "2026-09-28" }]) {
    assert.equal(applyConfirmedRelease(other, proof, now), other);
  }
  assert.equal(applyConfirmedRelease(episode, proof, proof.airTimestamp - 1), episode);
});
test("metadata floor is temporary, bounded by catalogue, and cannot accept future proof", () => {
  assert.equal(confirmedReleaseFloor(59, 61, proof, now), 60);
  assert.equal(confirmedReleaseFloor(61, 61, proof, now), 61);
  assert.equal(confirmedReleaseFloor(59, 59, proof, now), 59);
  assert.equal(confirmedReleaseFloor(59, 61, proof, now + 3 * 86400000), 59);
  assert.equal(isConfirmedReleaseValid({ ...proof, airTimestamp: now + 1000 }, now), false);
  assert.equal(isConfirmedReleaseValid({ ...proof, tmdbAirDate: "2026-09-28" }, now), false);
});
