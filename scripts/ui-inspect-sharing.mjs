import assert from "node:assert/strict";
import path from "node:path";

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
      await share().getByRole("button", { name: "Images", exact: true }).click();
      await share().locator("canvas").waitFor();
      const png = page.waitForEvent("download");
      await share().getByRole("button", { name: "Save this PNG", exact: true }).click();
      await (await png).saveAs(path.join(outputDir, `sharing-${width}.png`));
      await page.screenshot({ path: path.join(outputDir, `sharing-modal-${width}.png`) });

      const formats = [];
      for (const category of ["Text", "Images", "Choose together"]) {
        await share().getByRole("button", { name: category, exact: true }).click();
        const options = await share().locator("#format option").evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, name: node.textContent })));
        for (const option of options) {
          await share().locator("#format").selectOption(option.value);
          if (option.value === "three-picks") {
            await share().locator("summary").click();
            await share().getByRole("button", { name: "Shortlist Severance", exact: true }).click();
            await share().locator("summary").click();
          }
          if (["local-ballot", "browseable-list"].includes(option.value)) {
            const recipient = share().frameLocator('iframe[title="Try the recipient’s view"]');
            await recipient.locator("[data-id]").waitFor();
            assert.equal(await recipient.locator("[data-id]").count(), 1);
            await recipient.locator("[data-id]").click();
            await recipient.locator("#picks-count").filter({ hasText: "1 picked" }).waitFor();
            await recipient.getByRole("button", { name: "Clear picks" }).click();
            await recipient.locator("#picks-count").filter({ hasText: "0 picked" }).waitFor();
            const html = page.waitForEvent("download");
            await share().getByRole("button", { name: "Save recipient page (.html)", exact: true }).click();
            await (await html).saveAs(path.join(outputDir, `sharing-${width}-${option.value}.html`));
          } else if (category !== "Text") await share().locator("canvas").waitFor();
          else assert.match(await share().locator("#text-output").inputValue(), /Severance/);
          formats.push(option.value);
        }
      }
      assert.equal(formats.length, 16);
      console.log(`[ui-inspect:sharing] ${width}px: all 16 formats, clipboard, PNG downloads, and recipient picks passed`);
      await closeShare();
      await page.getByRole("button", { name: "Add to watchlist", exact: true }).click();
      await page.getByRole("button", { name: /^Tracking status:/ }).waitFor();
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
      assert.deepEqual(errors, []);
      console.log(`[ui-inspect:sharing] ${width}px: all 16 formats, clipboard, PNG, recipient picks, Library selection, and custom-list sharing passed`);
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
