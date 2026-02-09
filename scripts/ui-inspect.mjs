import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium, devices } from "@playwright/test";

const baseUrl = process.env.UI_BASE_URL ?? "http://localhost:8081";
const outputDir = path.resolve(
  process.cwd(),
  process.env.UI_SHOT_DIR ?? "artifacts/ui-inspect"
);
const headless = process.env.PW_HEADLESS !== "false";

const desktopRoutes = ["/", "/discover", "/search", "/profile"];
const mobileRoutes = ["/", "/discover"];
const timestamp = new Date().toISOString().replaceAll(":", "-");
const themes = [
  { key: "light", testId: "theme-light" },
  { key: "dark", testId: "theme-dark" },
];

function sanitizeRoute(route) {
  if (route === "/") {
    return "home";
  }
  return route.replaceAll("/", "_").replace(/^_+/, "");
}

async function captureSet(contextName, contextOptions, routes) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext(contextOptions);
  const findings = [];
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(600);

    const guestButton = page.getByText("Continue as guest", { exact: true });
    if (await guestButton.isVisible().catch(() => false)) {
      await guestButton.click();
      await page
        .waitForURL((url) => !url.pathname.endsWith("/login"), {
          timeout: 10000,
        })
        .catch(() => undefined);
      await page.waitForTimeout(2500);
      console.log(`[ui-inspect] Guest login completed (${contextName})`);
    }
  } catch (error) {
    console.warn(
      `[ui-inspect] Guest login skipped (${contextName}): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  page.on("console", (message) => {
    // eslint-disable-next-line no-console
    if (message.type() === "warning") {
      console.log(`[ui-inspect:${contextName}:warning] ${message.text()}`);
    }
  });

  for (const theme of themes) {
    try {
      await page.goto(`${baseUrl}/profile`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(800);
      const themeButton = page.getByTestId(theme.testId);
      if (await themeButton.isVisible().catch(() => false)) {
        await themeButton.click();
        await page.waitForTimeout(700);
      }
      console.log(`[ui-inspect] Theme set to ${theme.key} (${contextName})`);
    } catch (error) {
      console.warn(
        `[ui-inspect] Unable to set ${theme.key} theme (${contextName}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    for (const route of routes) {
      const url = `${baseUrl}${route}`;
      const pageFindings = {
        context: contextName,
        theme: theme.key,
        route,
        url,
        finalUrl: "",
        isAuthScreen: false,
        errors: [],
        warnings: [],
        pageErrors: [],
        requestFailures: [],
        screenshot: "",
      };

      const handleConsole = (message) => {
        if (message.type() === "error") {
          pageFindings.errors.push(message.text());
        } else if (message.type() === "warning") {
          pageFindings.warnings.push(message.text());
        }
      };

      const handlePageError = (error) => {
        pageFindings.pageErrors.push(error.message);
      };

      const handleRequestFailed = (request) => {
        pageFindings.requestFailures.push(
          `${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown"})`
        );
      };

      page.on("console", handleConsole);
      page.on("pageerror", handlePageError);
      page.on("requestfailed", handleRequestFailed);

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(1400);
        pageFindings.finalUrl = page.url();
        pageFindings.isAuthScreen = await page
          .getByText("Sign In", { exact: true })
          .isVisible()
          .catch(() => false);
        const screenshotPath = path.join(
          outputDir,
          `${timestamp}-${contextName}-${theme.key}-${sanitizeRoute(route)}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        pageFindings.screenshot = screenshotPath;
        console.log(
          `[ui-inspect] Captured ${route} (${contextName}, ${theme.key})`
        );
      } catch (error) {
        pageFindings.pageErrors.push(
          error instanceof Error ? error.message : String(error)
        );
        console.error(
          `[ui-inspect] Failed ${route} (${contextName}, ${theme.key})`
        );
      } finally {
        page.off("console", handleConsole);
        page.off("pageerror", handlePageError);
        page.off("requestfailed", handleRequestFailed);
        findings.push(pageFindings);
      }
    }
  }

  await page.close();
  await context.close();
  await browser.close();
  return findings;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const desktopFindings = await captureSet(
    "desktop",
    { viewport: { width: 1512, height: 980 } },
    desktopRoutes
  );
  const mobileFindings = await captureSet(
    "mobile",
    {
      ...devices["iPhone 13"],
      locale: "en-US",
      timezoneId: "America/New_York",
    },
    mobileRoutes
  );
  const mobileWindowFindings = await captureSet(
    "mobile-window",
    { viewport: { width: 390, height: 844 } },
    mobileRoutes
  );

  const allFindings = [...desktopFindings, ...mobileFindings, ...mobileWindowFindings];
  const reportPath = path.join(outputDir, `${timestamp}-report.json`);
  fs.writeFileSync(reportPath, JSON.stringify(allFindings, null, 2));

  const totalErrors =
    allFindings.reduce(
      (count, entry) =>
        count +
        entry.errors.length +
        entry.pageErrors.length +
        entry.requestFailures.length,
      0
    ) ?? 0;

  console.log(`[ui-inspect] Report saved to ${reportPath}`);
  if (totalErrors > 0) {
    console.log(`[ui-inspect] Found ${totalErrors} potential issues.`);
  } else {
    console.log("[ui-inspect] No console/request failures captured.");
  }
}

main().catch((error) => {
  console.error("[ui-inspect] Fatal error", error);
  process.exit(1);
});
