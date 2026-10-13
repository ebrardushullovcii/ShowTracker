import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

// Public catalogue covers only. Repeat them in a 634-title temporary export; no tracking writes.
const covers = [
  ["Saga of Tanya the Evil", "https://image.tmdb.org/t/p/w342/5nwiHomKZBBF9DLrolfZapi3fDm.jpg"],
  ["Aoashi", "https://image.tmdb.org/t/p/w342/erwRgEPtUtyv3Vkmxt0MhjKi5kA.jpg"],
  ["The Bear", "https://image.tmdb.org/t/p/w342/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg"],
  ["Ozark", "https://image.tmdb.org/t/p/w342/pCGyPVrI9Fzw6rE1Pvi4BIXF6ET.jpg"],
  ["Silo", "https://image.tmdb.org/t/p/w342/r2QXomqKjkKHVtYGGtkf2l2Y7go.jpg"],
  ["Better Call Saul", "https://image.tmdb.org/t/p/w342/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg"],
  ["South Park", "https://image.tmdb.org/t/p/w342/k7n2EVge7G77eMr3brztRGG1fFU.jpg"],
  ["Case Closed", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx235-MyYT7K3chBdO.jpg"],
  ["ONE PIECE", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-ELSYx3yMPcKM.jpg"],
];

export async function inspectExportCovers(browser, { baseUrl, outputDir }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/login`);
    await page.getByRole("button", { name: /continue as guest/i }).click();
    await page.waitForURL(/\/home$/);
    const urls = covers.map(([, url]) => `${url}?showtracker-cache-check=${Date.now()}`);
    // Ordinary app images warm responses without an Origin header, just like Library cards.
    await page.evaluate(async (urls) => {
      await Promise.all(urls.map((url) => new Promise((resolve, reject) => {
        const image = new Image(); image.onload = resolve; image.onerror = () => reject(new Error(`Could not warm ${url}`)); image.src = url;
      })));
    }, urls);
    await page.goto(`${baseUrl}/show/tvmaze:tv:44933`);
    await page.getByRole("button", { name: "More show actions" }).click();
    await page.getByRole("button", { name: "Share this show" }).click();
    const frame = await (await page.locator('iframe[title="Share preview and export options"]').elementHandle()).contentFrame();
    const shows = Array.from({ length: 634 }, (_, i) => ({
      id: `tmdb:tv:${10000000 + i}`, title: `${covers[i % covers.length][0]} · ${i + 1}`,
      year: "2022", kind: "TV Show", genres: [], runtime: null, poster: urls[i % urls.length], url: "", appUrl: "",
    }));
    // Exercise the running app's real composer and downloads with an isolated public fixture.
    const status = await frame.evaluate(async (shows) => {
      const script = document.createElement("script");
      script.textContent = `SHOWS.splice(0,SHOWS.length,...${JSON.stringify(shows)});state.selected=new Set(SHOWS.map(s=>s.id));state.title='My shows';state.note='';category='Images';current=CONCEPTS.find(c=>c.slug==='contact-sheet');formats();refreshSelection();`;
      document.body.append(script); script.remove();
      await eval("render()");
      return eval("({loaded:SHOWS.slice(0,30).filter(s=>imageCache.get(s.poster)?._loaded).length,pages:pagesFor(SHOWS).length,exportable:canvas.toDataURL().startsWith('data:image/png')})");
    }, shows);
    assert.deepEqual(status, { loaded: 30, pages: 22, exportable: true });
    assert.equal(await frame.locator("#notice").textContent(), "");
    const pngDownload = page.waitForEvent("download");
    await frame.getByRole("button", { name: "Save this PNG", exact: true }).click();
    await (await pngDownload).saveAs(path.join(outputDir, "cached-covers-contact-sheet.png"));
    await page.screenshot({ path: path.join(outputDir, "cached-covers-preview.png") });
    await frame.getByRole("button", { name: "Next page", exact: true }).click();
    await frame.locator('canvas[aria-label*="page 2 of 22"]').waitFor();
    assert.equal(await frame.locator("#notice").textContent(), "");
    const zipDownload = page.waitForEvent("download", { timeout: 120000 });
    await frame.getByRole("button", { name: "Save all images (.zip)", exact: true }).click();
    const zipPath = path.join(outputDir, "cached-covers-all-pages.zip");
    await (await zipDownload).saveAs(zipPath);
    const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
    assert.equal(Object.keys(zip.files).filter((name) => name.endsWith(".png")).length, 22);
    assert.equal((await zip.file("shows.txt").async("string")).split("\n").filter((line) => line.startsWith("• ")).length, 634);
    console.log("[ui-inspect:covers] Cached TMDB/AniList covers: 30/30 rendered, readable saved PNG, 22-page ZIP and all 634 titles passed");
  } finally { await context.close(); }
}
