import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createShareDocument } from "./document";
import { rendererScript } from "./renderer-script";
import { shareFormats } from "./formats";
import { toShareShow } from "./types";
import { normalizeSharedGame } from "./share-link";
import { pickTournament, startTournament } from "./tournament";
import { imageLoaderScript } from "./image-loader-script";

test("export boundary removes tracking data and qualifies normalized provider IDs", () => {
  const record = { title: "Example", mediaType: "tv", posterUrl: "http://image.tmdb.org/example.jpg", watchedEpisodes: 13, watchingWith: ["private friend"], status: "watching" };
  const show = toShareShow(record, "tmdb:123");
  assert.equal(show.id, "tmdb:tv:123");
  assert.equal(show.appUrl, "https://showtrackerapp.netlify.app/show/tmdb%3Atv%3A123");
  assert.equal(show.url, "https://www.themoviedb.org/tv/123");
  assert.equal(show.poster, "https://image.tmdb.org/example.jpg");
  assert.equal("watchedEpisodes" in show, false);
  assert.equal("watchingWith" in show, false);
  assert.equal("status" in show, false);
  assert.equal(toShareShow(record, "123").url, "");
});

test("every text format includes the full collection exactly once in one message", () => {
  const shows = Array.from({ length: 634 }, (_, i) => toShareShow({ title: `Show ${String(i + 1).padStart(4, "0")}`, mediaType: "tv", genres: [i % 2 ? "Comedy" : "Drama"] }, `tmdb:tv:${i + 1}`));
  const options = { title: "Planned is just my heading", note: "", name: "", context: "Shared collection", years: true, genres: false };
  for (const format of shareFormats.filter((format) => format.format === "text")) {
    const text = runInNewContext(rendererScript + "\nfullText(format,shows,options)", { shows, options, format, state: options, TextEncoder, Blob });
    assert.match(text, /634 shows · Shared collection/);
    assert.doesNotMatch(text, /\(\)|undefined|Not started/);
    for (const show of shows) assert.equal(text.split(show.title).length - 1, 1);
    if (format.layout === "chat") assert.match(text, /634\. Show 0634/);
  }
});

test("embedded titles and messages cannot terminate the script element", () => {
  const hostile = '</script><script>globalThis.injected=true</script>';
  const html = createShareDocument({ title: hostile, context: "Custom list", shows: [toShareShow({ title: hostile, mediaType: "anime" }, "anilist:anime:123")] });
  assert.equal((html.match(/<\/script>/g) ?? []).length, 1);
  assert.ok(html.includes("\\u003c/script>"));
});

test("a tournament includes every contender and finishes in exactly N minus one choices", () => {
  for (const count of [2, 3, 5, 20, 101]) {
    let game = startTournament(count, () => 0.5);
    const appeared = new Set<number>();
    let choices = 0;
    while (game.contenders.length > 1) {
      const pair = game.contenders.slice(game.cursor, game.cursor + 2);
      assert.equal(pair.length, 2);
      pair.forEach((index) => appeared.add(index));
      const previous = structuredClone(game);
      game = pickTournament(game, pair[0]);
      assert.equal(previous.decisions, choices);
      choices++;
      assert.ok(choices < count);
    }
    assert.equal(choices, count - 1);
    assert.equal(appeared.size, count);
    assert.equal(game.decisions, count - 1);
    assert.throws(() => pickTournament(game, game.contenders[0]));
  }
});

test("share links retain only public fields and rebuild catalogue URLs", () => {
  const show = toShareShow({ title: "Severance", mediaType: "tv", firstAired: "2022-01-01" }, "tvmaze:tv:44933");
  const other = toShareShow({ title: "Breaking Bad", mediaType: "tv" }, "tvmaze:tv:169");
  const input = { mode: "duel" as const, title: "Our game", note: "Choose one", name: "", shows: [{ ...show, url: "javascript:alert(1)", appUrl: "https://evil.example", status: "watching", watchingWith: ["private"] }, other], ownerId: "private owner" };
  const snapshot = normalizeSharedGame(input);
  assert.equal(snapshot.shows[0].url, "https://www.tvmaze.com/shows/44933");
  assert.equal(snapshot.shows[0].appUrl, "https://showtrackerapp.netlify.app/show/tvmaze%3Atv%3A44933");
  assert.equal(JSON.stringify(snapshot).includes("private"), false);
  assert.equal("status" in snapshot.shows[0], false);
  assert.throws(() => normalizeSharedGame({ ...input, shows: [show] }), /at least two/);
  assert.throws(() => normalizeSharedGame({ ...input, mode: "shortlist" }), /only game type/);
  assert.throws(() => normalizeSharedGame({ ...input, shows: [show, show] }), /Invalid show/);
  assert.throws(() => normalizeSharedGame({ ...input, shows: [{ ...show, poster: "data:image/png;base64,abc" }, other] }), /cover URL/);
});

test("canvas covers bypass ordinary image cache entries and retain successful decodes", async () => {
  const requests: { url: string; options: RequestInit }[] = [];
  const revoked: string[] = [];
  class TestImage {
    onload?: () => void;
    set src(value: string) {
      assert.equal(value, "blob:readable-cover");
      queueMicrotask(() => this.onload?.());
    }
  }
  const context = {
    imageCache: new Map(), Image: TestImage, AbortController, setTimeout, clearTimeout,
    URL: { createObjectURL: () => "blob:readable-cover", revokeObjectURL: (url: string) => revoked.push(url) },
    fetch: async (url: string, options: RequestInit) => {
      requests.push({ url, options });
      return { ok: true, blob: async () => new Blob(["cover"], { type: "image/jpeg" }) };
    },
  };
  const load = runInNewContext(imageLoaderScript + "\nloadImage", context);
  const url = "https://image.tmdb.org/t/p/w342/cached.jpg";
  const first = load(url), second = load(url);
  assert.equal(first, second);
  const image = await first;
  assert.ok(image);
  assert.equal(await load(url), image);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, url);
  assert.equal(requests[0].options.mode, "cors");
  assert.equal(requests[0].options.cache, "reload");
  assert.equal(requests[0].options.credentials, "omit");
  assert.deepEqual(revoked, ["blob:readable-cover"]);
});

test("failed cover requests can recover on the next preview or download", async () => {
  let attempts = 0;
  class TestImage {
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  }
  const imageCache = new Map();
  const load = runInNewContext(imageLoaderScript + "\nloadImage", {
    imageCache, Image: TestImage, AbortController, setTimeout, clearTimeout,
    URL: { createObjectURL: () => "blob:cover", revokeObjectURL: () => {} },
    fetch: async () => ({ ok: ++attempts > 1, blob: async () => new Blob(["cover"]) }),
  });
  const url = "https://image.tmdb.org/temporary-failure.jpg";
  assert.equal(await load(url), null);
  assert.equal(imageCache.has(url), false);
  assert.ok(await load(url));
  assert.equal(attempts, 2);
});
