import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createShareDocument } from "./document";
import { rendererScript } from "./renderer-script";
import { shareFormats } from "./formats";
import { toShareShow } from "./types";

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
