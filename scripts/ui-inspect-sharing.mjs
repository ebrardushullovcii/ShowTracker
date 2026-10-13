import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";

/** Temporary export-only fixture: no Library or custom-list writes. */
async function inspectFullText(page, outputDir, width) {
  const frame = await (await page.locator('iframe[title="Share preview and export options"]').elementHandle()).contentFrame();
  await frame.evaluate(async () => {
    const script = document.createElement("script");
    script.textContent = "SHOWS.splice(0,SHOWS.length,...Array.from({length:634},(_,i)=>({...SHOWS[0],id:'tmdb:tv:'+(10000000+i),title:'Show '+String(i+1).padStart(4,'0'),genres:[i%2?'Comedy':'Drama']})));state.selected=new Set(SHOWS.map(s=>s.id));refreshSelection();";
    document.body.append(script); script.remove();
    await eval("render()");
  });
  const options = await frame.locator("#format option").evaluateAll((nodes) => nodes.map((node) => node.value));
  assert.equal(options.length, 4);
  for (const format of options) {
    await frame.locator("#format").selectOption(format);
    assert.equal(await frame.locator("#pagination").isVisible(), false);
    const area = frame.locator("#text-output");
    const text = await area.inputValue();
    assert.match(text, /634 shows/);
    assert.equal((text.match(/Show \d{4}/g) || []).length, 634);
    assert.match(text, /Show 0634/);
    if (format === "chat-message") assert.match(text, /634\. Show 0634/);
    const edited = text + "\nMy final note.";
    await area.fill(edited);
    await frame.getByRole("button", { name: "Copy text", exact: true }).click();
    // Windows clipboard converts line endings to CRLF; compare the full text after normalization.
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n"), edited);
    assert.equal(await frame.getByRole("button", { name: "Copy all messages", exact: true }).count(), 0);
    const download = page.waitForEvent("download");
    await frame.getByRole("button", { name: "Save .txt", exact: true }).click();
    const file = path.join(outputDir, `full-text-${width}-${format}.txt`);
    await (await download).saveAs(file);
    assert.equal(fs.readFileSync(file, "utf8"), edited);
  }
  await page.screenshot({ path: path.join(outputDir, `full-text-${width}.png`) });
  console.log(`[ui-inspect:text] ${width}px: all four formats include 634 titles in one preview; edited copy and saved text match exactly`);
}

/** Explicit sharing preset: creates and removes a fixture in a fresh guest account. */
export async function inspectSharing(browser, { baseUrl, outputDir, navigateWithAuthRecovery }) {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const showUrl = `${baseUrl}/show/tvmaze:tv:44933`;
    const name = `Sharing check ${width} ${Date.now()} A very long collection title for checking the phone share header`.slice(0, 100);
    let listUrl = null;
    let tracked = false;
    const share = () => page.frameLocator('iframe[title="Share preview and export options"]');
    const closeShare = () => page.getByRole("button", { name: "Close share preview", exact: true }).click();
    try {
      await page.goto(`${baseUrl}/login`);
      await page.getByRole("button", { name: /continue as guest/i }).click();
      await page.waitForURL(/\/home$/);
      await navigateWithAuthRecovery(page, `sharing-${width}`, `${baseUrl}/library`, 500, "sharing-guest");
      await page.getByText("0 matched", { exact: true }).waitFor();
      await page.goto(showUrl);
      await page.getByRole("button", { name: "More show actions" }).click();
      await page.getByRole("button", { name: "Share this show" }).click();
      assert.match(await share().locator("#text-output").inputValue(), /Severance \(2022\)/);
      await share().getByRole("button", { name: "Copy text", exact: true }).click();
      await share().locator("#notice").filter({ hasText: "Copied" }).waitFor();
      assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Severance/);
      await inspectFullText(page, outputDir, width);
      await closeShare();
      await page.getByRole("button", { name: "More show actions" }).click();
      await page.getByRole("button", { name: "Share this show" }).click();
      await share().getByRole("button", { name: "Images", exact: true }).click();
      await share().locator("canvas").waitFor();
      const png = page.waitForEvent("download");
      await share().getByRole("button", { name: "Save this PNG", exact: true }).click();
      await (await png).saveAs(path.join(outputDir, `sharing-${width}.png`));
      await page.screenshot({ path: path.join(outputDir, `sharing-modal-${width}.png`) });

      const formats = [];
      for (const category of ["Text", "Images"]) {
        await share().getByRole("button", { name: category, exact: true }).click();
        const options = await share().locator("#format option").evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, name: node.textContent })));
        for (const option of options) {
          await share().locator("#format").selectOption(option.value);
          if (category !== "Text") await share().locator("canvas").waitFor();
          else assert.match(await share().locator("#text-output").inputValue(), /Severance/);
          formats.push(option.value);
        }
      }
      assert.equal(formats.length, 12);
      assert.ok(!formats.includes("local-ballot") && !formats.includes("browseable-list"));
      assert.equal(await share().locator("iframe").count(), 0);
      console.log(`[ui-inspect:sharing] ${width}px: all 12 exports, clipboard, PNG downloads passed`);
      await share().getByRole("button", { name: "This or that", exact: true }).click();
      await share().getByText("Include at least two shows to play This or that.", { exact: true }).waitFor();
      assert.equal(await share().locator("canvas, [data-pin]").count(), 0);
      assert.equal(await share().getByRole("button", { name: /Save|image|zip|Shortlist/ }).count(), 0);
      await closeShare();
      await page.getByRole("button", { name: "Add to watchlist", exact: true }).click();
      await page.locator('[aria-label^="Tracking status:"]:not([disabled]):not([aria-disabled="true"])').waitFor();
      tracked = true;
      await page.goto(`${baseUrl}/library`);
      await page.getByText("1 matched", { exact: true }).waitFor();
      await page.getByRole("button").filter({ hasText: /^Planned/i }).click();
      await page.getByRole("button", { name: "Share", exact: true }).click();
      assert.match(await share().locator("#text-output").inputValue(), /1 show · Not started/);
      await share().locator("summary").click();
      await share().getByRole("button", { name: "Clear selection", exact: true }).click();
      await share().getByText("No shows included", { exact: true }).waitFor();
      await share().getByRole("button", { name: "Include all", exact: true }).click();
      assert.match(await share().locator("#text-output").inputValue(), /Severance/);
      await closeShare();

      await page.goto(`${baseUrl}/list/create`);
      await page.getByPlaceholder("e.g., Favorite Anime").fill(name);
      await page.getByText("Create list", { exact: true }).click();
      await page.waitForURL(/\/list\/(?!create)[^/]+$/);
      listUrl = page.url();
      await page.goto(showUrl);
      await page.getByRole("button", { name: "More show actions" }).click();
      await page.getByRole("button", { name: "Add to List", exact: true }).click();
      await page.getByText(name, { exact: true }).click();
      await page.getByText("1 show", { exact: true }).waitFor();
      await page.getByText("Done", { exact: true }).click();
      await page.goto(listUrl);
      await page.getByRole("button", { name: "Share list", exact: true }).click();
      const text = await share().locator("#text-output").inputValue();
      assert.ok(text.includes(name));
      assert.match(text, /Severance \(2022\)/);
      assert.doesNotMatch(text, /Not started/);
      const closeBox = await page.getByRole("button", { name: "Close share preview", exact: true }).boundingBox();
      assert.ok(closeBox && closeBox.x >= 0 && closeBox.x + closeBox.width <= width, "Long list names must keep Close inside the viewport");
      await closeShare();
      for (const id of ["tvmaze:tv:169", "tvmaze:tv:82"]) {
        await page.goto(`${baseUrl}/show/${id}`);
        await page.getByRole("button", { name: "More show actions" }).click();
        await page.getByRole("button", { name: "Add to List", exact: true }).click();
        await page.getByText(name, { exact: true }).click();
        await page.getByText(id.endsWith("169") ? "2 shows" : "3 shows", { exact: true }).waitFor();
        await page.getByText("Done", { exact: true }).click();
      }
      await page.goto(listUrl);
      await page.getByRole("button", { name: "Share list", exact: true }).click();
      await share().getByRole("button", { name: "This or that", exact: true }).click();
      {
        const format = "this-or-that";
        assert.equal(await share().locator("canvas, [data-pin]").count(), 0);
        assert.equal(await share().locator("#format").isVisible(), false);
        assert.equal(await share().locator("#pagination").isVisible(), false);
        assert.deepEqual(await share().locator("#actions button").allTextContents(), ["Create share link"]);
        // The game creator renders immediately; let the app modal's fade finish.
        await page.waitForTimeout(350);
        await share().locator(".game-cover img").evaluateAll((nodes) => Promise.all(nodes.map((node) => node.decode().catch(() => {}))));
        await page.screenshot({ path: path.join(outputDir, `sharing-creator-${width}.png`) });
        const firstCover = share().locator(".game-cover").first();
        await firstCover.locator("img").evaluate((node) => node.dispatchEvent(new Event("error")));
        assert.equal(await firstCover.locator("img").count(), 0, "Failed creator covers must show their fallback");
        assert.equal(await firstCover.locator("span").textContent(), "S");
        await share().getByRole("button", { name: "Create share link", exact: true }).click();
        await share().locator("#share-url").waitFor();
        await share().getByText("Link ready", { exact: true }).waitFor();
        await share().locator(".game-cover img").evaluateAll((nodes) => Promise.all(nodes.map((node) => node.decode().catch(() => {}))));
        await page.screenshot({ path: path.join(outputDir, `sharing-link-ready-${width}.png`) });
        assert.deepEqual(await share().locator("#actions button").allTextContents(), ["Copy link", "Share link", "Remove link"]);
        const url = await share().locator("#share-url").inputValue();
        assert.match(url, /\/share\/[a-f0-9]{40}$/);
        await share().getByRole("button", { name: "Copy link", exact: true }).click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), url);
        const recipientContext = await browser.newContext({ viewport: { width, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
        const recipient = await recipientContext.newPage();
        recipient.on("pageerror", (error) => errors.push(error.message));
        try {
          await recipient.goto(url);
          await recipient.getByRole("button", { name: "Start game", exact: true }).waitFor();
          await recipient.screenshot({ path: path.join(outputDir, `sharing-intro-${width}.png`) });
          await recipient.getByRole("button", { name: "Start game", exact: true }).click();
          assert.equal(recipient.url(), url, "Public games must work without a login redirect");
          await recipient.waitForFunction(() => !document.querySelector('[data-testid="game-cover-loading"]'));
          await recipient.screenshot({ path: path.join(outputDir, `sharing-game-${width}-${format}.png`) });
          await recipient.getByRole("button", { name: /^Pick / }).first().click();
          await recipient.getByRole("button", { name: "Undo last choice", exact: true }).click();
          await recipient.getByText("Round 1 · 2 choices to your winner", { exact: true }).waitFor();
          await recipient.getByRole("button", { name: /^Pick / }).first().click();
          await recipient.getByRole("button", { name: /^Pick / }).first().click();
          await recipient.getByText("Your winner", { exact: true }).waitFor();
          await recipient.waitForFunction(() => !document.querySelector('[data-testid="game-cover-loading"]'));
          const resultBox = await recipient.getByText(/^I’d watch /).boundingBox();
          assert.ok(resultBox && resultBox.x >= 0 && resultBox.x + resultBox.width <= width, "Result text must fit the phone viewport");
          await recipient.screenshot({ path: path.join(outputDir, `sharing-result-${width}-${format}.png`) });
          if (width === 390) {
            await recipient.setViewportSize({ width: 320, height: 640 });
            for (const label of ["Share my result", "Copy my result"]) {
              const box = await recipient.getByRole("button", { name: label, exact: true }).boundingBox();
              assert.ok(box && box.x >= 0 && box.x + box.width <= 320, "Result actions must fit small phones");
            }
            await recipient.screenshot({ path: path.join(outputDir, "sharing-result-320.png") });
            await recipient.setViewportSize({ width, height: 900 });
          }
          await recipient.getByRole("button", { name: "Copy my result", exact: true }).click();
          assert.match(await recipient.evaluate(() => navigator.clipboard.readText()), /I’d watch .+!\r?\nhttps:\/\/showtrackerapp\.netlify\.app\/share\/[a-f0-9]{40}/);
          await recipient.getByRole("button", { name: "Play again", exact: true }).click();
          assert.equal(await recipient.getByRole("button", { name: "Copy my result", exact: true }).count(), 0);
        } finally {
          await share().getByRole("button", { name: "Remove link", exact: true }).click();
          await share().locator("#notice").filter({ hasText: "Link removed" }).waitFor();
          await recipient.reload();
          await recipient.getByText("This link is unavailable", { exact: true }).waitFor();
          await recipientContext.close();
        }
      }
      await closeShare();
      assert.deepEqual(errors, []);
      console.log(`[ui-inspect:sharing] ${width}px: all 12 exports, clipboard, PNG, Library/custom-list sharing, signed-out games, results, replay, and link revocation passed`);
    } catch (error) {
      await page.screenshot({ path: path.join(outputDir, `sharing-failure-${width}.png`) }).catch(() => {});
      throw error;
    } finally {
      if (listUrl) {
        await page.goto(listUrl);
        await page.getByRole("button", { name: "Delete list", exact: true }).click();
        await page.getByText("Delete", { exact: true }).click();
      }
      if (tracked) {
        await page.goto(showUrl);
        await page.getByRole("button", { name: "More show actions" }).click();
        await page.getByRole("button", { name: "Remove from Library", exact: true }).click();
        await page.getByText("Remove from Library", { exact: true }).last().click();
        await page.getByRole("button", { name: "Add to watchlist", exact: true }).waitFor();
        await page.goto(`${baseUrl}/library`);
        await page.getByText("0 matched", { exact: true }).waitFor();
      }
      await context.close();
    }
  }
}
