# ShowTracker Agent Guide

ShowTracker is a fast, minimal, open source tracker for shows, anime, and movies, a cleaner TVTime replacement, built as one Expo codebase with Convex for synced user data. Live app: https://showtrackerapp.netlify.app. Product direction: `docs/GOALS.md`. Vocabulary: `CONTEXT.md`. System shape and production runtime: `docs/ARCHITECTURE.md`. Decisions: `docs/DECISIONS.md` and the ADRs it indexes. Code is current behavior; docs are memory.

## How to work

- Treat a bug report as a request to fix and ship. Use the live URL or screenshots when given, make the smallest correct change, and verify the result in production.
- Delivery: branch (`feat/`, `fix/`, or `docs/`), validate, commit, push, PR, merge to `main` once checks pass. Netlify deploys the web app from `main`. Run `npx convex deploy --yes` when backend behavior changed. When schedule-confidence is involved, sync and run the VPS (commands in `docs/SCHEDULE_CONFIDENCE.md`). Then test the live app.
- Never push directly to `main`. Follow-ups to an open PR stay on that PR's branch.
- Local Expo and Convex servers are fine for iteration, but final verification of a production-intended change uses the live app against production Convex.
- Browser work uses the built-in Browser or Chrome tooling of whichever agent you are running in; prefer Chrome/CDP for console, network, DOM/CSS, and DevTools-level debugging. Do not install or invoke standalone automation frameworks (`agent-browser`, Playwright, Puppeteer) unless the user asks. The `npm run ui:inspect` wrappers are allowed; `scripts/test-app.sh` depends on the removed `agent-browser` CLI and is not a supported path.
- Never commit API keys, tokens, credentials, or machine connection details. Never store images in Convex; store external CDN URLs.
- Skills and `skills-lock.json` are managed by the user; do not install, regenerate, or remove them. Do not create `.claude/` content.

## Conventions that are decisions, not habits

- App UI images use `Image` from `react-native`, not `expo-image`, even though the dependency is installed.
- Provider APIs are called only from `lib/api/*` clients or Convex actions, never from screens or components, and responses are normalized before UI use.
- User-owned synced state goes through Convex. No ad hoc local-only persistence as a source of truth.
- Convex functions use `v.*` validators, validate auth where user data is involved, and prefer indexed queries over `.filter()` scans.
- Route and join IDs are provider-qualified (`tmdb:tv:123`, `anilist:anime:789`). Never compare bare numeric IDs across providers.

## Watchlist and schedule change control

Home watchlist, Home attention feed, schedule calendar, schedule cache, episode availability, provider reconciliation, release facts, duplicate collapse, route IDs, and projection reads are the highest-risk paths in this repo. The ADRs are the long-term memory for why they behave as they do; they are not cleanup targets.

Before changing these paths, read `docs/DECISIONS.md` and the latest relevant ADRs. Any change that can affect what appears in Home, Watchlist, or Schedule, or that touches release availability, provider matching, duplicate collapse, route IDs, or projection reads, requires a new `docs/ADR-####-short-title.md` before or with the code change. Each ADR includes context, current behavior, decision, reasoning, provider/data assumptions, edge cases, verification, and rollback notes. If unsure whether a change touches these paths, treat it as if it does.

Never weaken release-state correctness to reduce Convex I/O; move expensive work to the schedule-confidence reconciler and apply compact deltas. Never reintroduce broad aggregate repair or backfill from routine app navigation.

## Validation

Use the narrowest check that proves the change: `npm run lint`, `npx tsc --noEmit --pretty false`, and for backend changes `npx convex dev --once --typecheck enable --tail-logs disable`. Use `npm run ui:inspect:quick` after UI changes when multi-route, theme, or device screenshot coverage is useful. Reconciler commands and the VPS runtime are in `docs/SCHEDULE_CONFIDENCE.md`; everything else is in `package.json` and `.env.example`.

## Docs

Keep docs durable: goals, architecture, decisions. No phase logs, handoff notes, or one-off plans. When code and docs disagree, code is current behavior; fix the doc when the task calls for it.
