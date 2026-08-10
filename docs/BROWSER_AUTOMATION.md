# Browser Tooling Guide

Use Codex's built-in browser surfaces during development and production verification.

## Tool Choice

- Use the built-in Browser plugin for an isolated in-app browsing session.
- Use the built-in Chrome plugin when the task depends on the user's existing Chrome tabs, login state, or extensions. It connects through Chrome/CDP.
- Prefer Chrome/CDP for console, network, DOM/CSS, performance, and DevTools-level debugging.
- Do not install or invoke standalone browser automation frameworks or CLIs directly, such as `agent-browser`, Playwright, or Puppeteer, unless the user explicitly asks for one. Existing repo-maintained validation wrappers such as `npm run ui:inspect` are allowed.

If a requested built-in surface is unavailable, report that limitation rather than silently substituting a standalone automation framework.

## UI Verification

Use `npm run ui:inspect:quick` or `npm run ui:inspect` only when its existing screenshot sweep is useful after a UI change. These project scripts are regression checks, not a replacement for the built-in Browser or Chrome plugin.

The older `scripts/test-app.sh` workflow depends on the removed `agent-browser` CLI and is not a supported validation path. Do not invoke it unless it is explicitly migrated in a separate task.

For UI bugs:

1. Inspect the broken route with the built-in Browser or Chrome plugin.
2. Fix the code.
3. Re-check the route with the same built-in surface.
4. Run the existing UI inspection script when multi-route, theme, or device coverage is useful.

## ShowTracker Notes

- The default local web URL is usually `http://localhost:8081`.
- The live app is `https://showtrackerapp.netlify.app`.
- If the task touches Convex-backed behavior, make sure the backend is running too.
- For production-intended fixes, verify against production Convex after deploying relevant backend changes.
- When the report compares two live surfaces, such as detail vs schedule or Home vs watchlist, verify both surfaces before and after the fix when possible.
- Browser tooling in this repo is for development iteration and live verification, not formal end-to-end test authoring unless the user asks for that separately.
