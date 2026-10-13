import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createShareDocument } from "./document";
import { rendererScript } from "./renderer-script";
import { shareFormats } from "./formats";
import { toShareShow } from "./types";
import { normalizeSharedGame } from "./share-link";
import { pickTournament, startTournament } from "./tournament";

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

test("text pagination includes every title exactly once and retains global numbers", () => {
  const shows = Array.from({ length: 61 }, (_, i) => toShareShow({ title: `Show ${i}`, mediaType: "tv", genres: [i % 2 ? "Comedy" : "Drama"] }, `tmdb:tv:${i + 1}`));
  const options = { title: "Planned is just my heading", note: "", name: "", context: "Shared collection", years: true, genres: false };
  const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
  const context = { shows, options, chunks, chat: shareFormats[1], grouped: shareFormats[2], state: options, TextEncoder, Blob };
  const result = runInNewContext(rendererScript + "\n({pages:textPages(chat,shows,options),grouped:fullText(grouped,shows,options),text:fullText(chat,shows,options)})", context);
  assert.equal(result.pages.length, 7);
  assert.match(result.pages[6], /61\. Show 60/);
  assert.doesNotMatch(result.pages.join("\n"), /\(\)|undefined/);
  assert.equal(result.grouped.split("\n").filter((line: string) => line.startsWith("• ")).length, 61);
  assert.match(result.text, /61 shows · Shared collection/);
  assert.doesNotMatch(result.text, /Not started/);
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
  const input = { mode: "shortlist" as const, title: "Our picks", note: "Choose one", name: "", shows: [{ ...show, url: "javascript:alert(1)", appUrl: "https://evil.example", status: "watching", watchingWith: ["private"] }], ownerId: "private owner" };
  const snapshot = normalizeSharedGame(input);
  assert.equal(snapshot.shows[0].url, "https://www.tvmaze.com/shows/44933");
  assert.equal(snapshot.shows[0].appUrl, "https://showtrackerapp.netlify.app/show/tvmaze%3Atv%3A44933");
  assert.equal(JSON.stringify(snapshot).includes("private"), false);
  assert.equal("status" in snapshot.shows[0], false);
  assert.throws(() => normalizeSharedGame({ ...input, mode: "duel" }), /at least two/);
  assert.throws(() => normalizeSharedGame({ ...input, shows: [show, show] }), /Invalid show/);
  assert.throws(() => normalizeSharedGame({ ...input, shows: [{ ...show, poster: "data:image/png;base64,abc" }] }), /cover URL/);
});
