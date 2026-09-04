# ShowTracker Architecture

## System Shape

```text
Expo app (native + web)
  -> lib/api provider clients for TMDB, TVMaze, AniList, Jikan
  -> Convex client for auth, user state, projections, repairs
  -> Convex database and functions
  -> schedule-confidence SQLite reconciler for heavyweight release intelligence
  -> compact release/projection deltas back to Convex
```

Convex is the source of truth for user-owned synced state. Provider APIs are sources of catalog, identity, schedule, and release facts. The schedule-confidence reconciler (`scripts/schedule-confidence.mjs`, see `docs/SCHEDULE_CONFIDENCE.md`) does heavyweight provider and release reconciliation outside reactive app reads, then writes compact facts back through `convex/scheduleConfidence.ts`.

## Production Runtime

```text
main branch
  -> Netlify auto-deploys the web app (https://showtrackerapp.netlify.app)
  -> Convex production serves auth, user data, functions, projections, and crons
  -> private VPS at /opt/showtracker runs schedule-confidence from origin/main
  -> Browser verification checks the live app against production data
```

Treat production bugs as cross-system until proven otherwise. A detail page can be correct because it reads provider/detail facts while Home or Schedule is wrong because projection, schedule cache, or VPS reconciliation state is stale. When diagnosing a mismatch between detail, Home, Watchlist, and Schedule, identify which layer produced each fact before changing behavior:

- provider client/detail payload
- Convex cached show metadata
- `feedProjections`
- `scheduleCache`
- user schedule projections
- schedule-confidence SQLite/VPS output

## Frontend

Expo Router 6 with authenticated shell routes and direct-linkable detail and list routes. Show details open as overlay routes in-app while direct URLs still work (ADR-0001). Styling is NativeWind.

## Provider Layer

`lib/api/` clients return normalized types from `lib/api/types.ts`; screens never consume raw provider responses. Normalize first, then persist through Convex where synced user state is involved.

## Convex Backend

One file per domain under `convex/`. The reads that matter for cost and correctness are the compact projections: `feedProjections` (per-user show rows for Home, Library, and tracked-state checks) and the user schedule projections (`userScheduleEvents`, `watchlistFutureCountProjections`, `userScheduleProjectionWindows`). Home and Schedule read those when fresh and fall back only through guarded legacy schedule-cache paths (ADR-0010, ADR-0011).

## Core Flows

```text
Track a title
  -> Convex upserts normalized show metadata and userShows
  -> feedProjections refresh for cheap Home/Library reads

Watch progress
  -> mutation updates watchedEpisodes and userShows
  -> focused stats/projection repair refreshes derived state (never a broad rebuild)

Home / Schedule query
  -> reads feedProjections and user schedule projections when fresh
  -> guarded fallback to legacy schedule cache
  -> provider-ID-first matching, conservative title fallback

Release reconciliation
  -> reconciler imports tracked library and schedule cache
  -> reconciles provider links and release facts in SQLite
  -> emits audit issues and compact deltas
  -> convex/scheduleConfidence.ts applies them
```

The reconciler makes missing provider links, title-only matches, conflicting provider IDs, and stale release facts inspectable instead of silently absent.

## Routing And Identity

Route IDs are provider-qualified: `tmdb:tv:123`, `tmdb:movie:456`, `anilist:anime:789`, `jikan:anime:321`, `tvmaze:tv:654`. Never compare bare numeric IDs across providers. Provider matching rules live in ADRs, especially ADR-0002 and ADR-0017 through ADR-0021; title fallback stays narrow and auditable.

## Guardrails

- User-owned synced data stays in Convex.
- Provider API calls stay in `lib/api/*` or Convex actions.
- Broad aggregate repair or backfill never runs from normal app navigation.
- Watchlist, schedule, release, provider, and projection changes need ADR coverage.
- Optimize Convex I/O by materializing compact projections, not by hiding correct release facts.
