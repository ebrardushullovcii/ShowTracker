import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAniListCredits,
  normalizeTmdbCredits,
  normalizeTvMazeCredits,
} from "@/lib/api/credits";

test("TMDB TV cast shows an anthology actor's longest role and role count", () => {
  const credits = normalizeTmdbCredits("tv", {
    aggregate_credits: {
      cast: [
        {
          id: 1,
          name: "Evan Peters",
          profile_path: "/evan.jpg",
          total_episode_count: 112,
          roles: [
            { character: "Kyle Spencer", episode_count: 13 },
            { character: "Tate Langdon", episode_count: 25 },
          ],
        },
      ],
    },
  });

  assert.deepEqual(credits.cast[0], {
    id: "tmdb:person:1",
    name: "Evan Peters",
    character: "Tate Langdon",
    photoUrl: "https://image.tmdb.org/t/p/w185/evan.jpg",
    isVoice: false,
    episodeCount: 112,
    roleCount: 2,
  });
});

test("TMDB strips the (voice) suffix and flags voice roles", () => {
  const credits = normalizeTmdbCredits("tv", {
    aggregate_credits: {
      cast: [
        {
          id: 2,
          name: "Hailee Steinfeld",
          profile_path: null,
          total_episode_count: 18,
          roles: [{ character: "Vi (voice)", episode_count: 18 }],
        },
      ],
    },
  });

  assert.equal(credits.cast[0].character, "Vi");
  assert.equal(credits.cast[0].isVoice, true);
  assert.equal(credits.cast[0].photoUrl, undefined);
  assert.equal(credits.cast[0].roleCount, undefined);
});

test("TMDB movie crew keeps key jobs and merges one person's jobs", () => {
  const credits = normalizeTmdbCredits("movie", {
    credits: {
      cast: [],
      crew: [
        { id: 7, name: "Hans Zimmer", job: "Original Music Composer" },
        { id: 5, name: "Denis Villeneuve", job: "Screenplay" },
        { id: 5, name: "Denis Villeneuve", job: "Director" },
        { id: 9, name: "Someone", job: "Gaffer" },
      ],
    },
  });

  assert.deepEqual(
    credits.crew.map((member) => [member.name, member.job]),
    [
      ["Denis Villeneuve", "Director, Screenplay"],
      ["Hans Zimmer", "Composer"],
    ]
  );
});

test("TMDB TV crew starts with creators", () => {
  const credits = normalizeTmdbCredits("tv", {
    created_by: [{ id: 3, name: "Ryan Murphy", profile_path: "/ryan.jpg" }],
    aggregate_credits: {
      cast: [],
      crew: [{ id: 4, name: "Director Person", jobs: [{ job: "Director", episode_count: 9 }] }],
    },
  });

  assert.deepEqual(
    credits.crew.map((member) => member.job),
    ["Creator", "Director"]
  );
});

test("AniList credits pair characters with voice actors and drop placeholder art", () => {
  const credits = normalizeAniListCredits({
    characters: {
      edges: [
        {
          role: "MAIN",
          node: { id: 10, name: { full: "Frieren" }, image: { large: "https://s4.anilist.co/c/frieren.png" } },
          japaneseVoiceActors: [
            { id: 20, name: { full: "Atsumi Tanezaki" }, image: { large: "https://s4.anilist.co/s/default.jpg" } },
          ],
          voiceActors: [],
        },
        {
          role: "SUPPORTING",
          node: { id: 11, name: { full: "Side Character" }, image: null },
          japaneseVoiceActors: [],
          voiceActors: [{ id: 21, name: { full: "Dub Actor" }, image: null, languageV2: "English" }],
        },
      ],
    },
    staff: {
      edges: [
        { role: "Director", node: { id: 30, name: { full: "Keiichirou Saitou" } } },
        { role: "Episode Director (ep 3)", node: { id: 31, name: { full: "Skip Me" } } },
      ],
    },
  });

  assert.equal(credits.cast[0].character, "Frieren");
  assert.equal(credits.cast[0].name, "Atsumi Tanezaki");
  assert.equal(credits.cast[0].photoUrl, undefined);
  assert.equal(credits.cast[0].voiceLanguage, "Japanese");
  assert.equal(credits.cast[0].isMainCharacter, true);
  assert.equal(credits.cast[1].voiceLanguage, "English");
  assert.deepEqual(credits.crew.map((member) => member.name), ["Keiichirou Saitou"]);
});

test("TVMaze credits keep voice flags and only creator-type crew", () => {
  const credits = normalizeTvMazeCredits(
    [
      {
        person: { id: 1, name: "Voice Person", image: { medium: "http://static.tvmaze.com/a.jpg" } },
        character: { id: 2, name: "Hero" },
        voice: true,
      },
    ],
    [
      { type: "Creator", person: { id: 3, name: "Maker" } },
      { type: "Casting Director", person: { id: 4, name: "Skip" } },
    ]
  );

  assert.equal(credits.cast[0].isVoice, true);
  assert.equal(credits.cast[0].photoUrl, "https://static.tvmaze.com/a.jpg");
  assert.deepEqual(credits.crew.map((member) => member.name), ["Maker"]);
});
