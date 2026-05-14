# Schedule And Watchlist Reliability Plan

Last updated: 2026-05-14

## Problem

Some tracked titles can disappear from the Home Watchlist or Schedule until the user searches for the title and opens its detail route.

The production Dr. STONE incident exposed two separate failure modes:

- Home Watchlist depended on stale `shows` / `feedProjections` metadata. Opening `/show/tmdb:tv:86031` triggered the detail-page metadata refresh path, which updated `releasedEpisodes` and the matching `feedProjections` row so the title appeared again.
- Schedule had fresh AniList schedule data for Dr. STONE, but the tracked Library entry was a TMDB TV show with no AniList/MAL alias. The schedule row was keyed as `anilist:199221` / `drstonesciencefuturecour3`; the tracked projection was keyed as `tmdb:tv:86031` / `tv:drstone`, so `getUpcomingSchedule` could not match them.

This should not be fixed by broad title matching. Titles such as anime One Piece and live-action ONE PIECE prove that same-title matching across providers and media types can create incorrect schedule entries.

## Goals

- Schedule should show tracked TV/anime episodes even when the user originally tracked the title from a different provider.
- Home Watchlist should not require opening a detail page before newly released episodes become visible.
- Matching should be confidence-based and durable, not recalculated with loose heuristics on every query.
- The fix must avoid reintroducing broad aggregate backfills on normal app paths.
- Convex reads for Home Watchlist and Schedule should get smaller or stay bounded.

## Non-Goals

- Do not guarantee perfect matching for every obscure title without provider identifiers.
- Do not merge all provider records into one canonical media database in one pass.
- Do not replace TMDB, AniList, TVMaze, or Jikan clients.
- Do not make global schedule cache rows larger to solve a per-user matching problem.

## Recommended Long-Term Design

Add a durable identity layer between external providers and user-facing projections.

### 1. Add `showIdentityAliases`

Create a new Convex table that records known provider aliases for a show.

Suggested fields:

```ts
showIdentityAliases: {
  showId: Id<"shows">;
  provider: "tmdb" | "tvdb" | "imdb" | "anilist" | "mal" | "tvmaze";
  mediaType: "tv" | "anime" | "movie";
  externalId: string;
  confidence: "verified" | "provider" | "heuristic";
  source: "tmdb" | "anilist" | "jikan" | "tvmaze" | "import" | "manual" | "schedule_match";
  matchedBy: string;
  createdAt: number;
  updatedAt: number;
}
```

Required indexes:

- `by_show` on `showId`.
- `by_provider_external` on `provider`, `externalId`.
- `by_show_provider` on `showId`, `provider`.

Why a table instead of an array on `shows`:

- Schedule matching needs fast lookup by provider external id.
- Convex cannot efficiently index arbitrary alias objects inside an array.
- Alias rows can carry confidence, source, and audit metadata without bloating every show document.

### 2. Build An Identity Resolver

Add a backend resolver module, probably `convex/identity.ts` or a clearly separated section in `convex/shows.ts`, that can enrich one show at a time.

Resolver inputs:

- Existing `shows` document.
- Optional schedule entry context.
- Optional known import/search metadata.

Resolver output:

- Alias rows to upsert.
- Whether the show document should be patched with stronger direct fields like `anilistId`, `malId`, `tvmazeId`, `tvdbId`, or `imdbId`.
- A confidence summary for logging and audits.

Preferred match order:

1. Existing exact identifiers already on the show.
2. Provider-backed identifier lookups already supported in code, such as MAL -> AniList and TVDB/IMDb -> TMDB/TVMaze.
3. Provider metadata enrichment that should be added where missing, such as a TMDB external IDs lookup for TV records.
4. High-confidence title/year/provider corroboration only when at least two signals agree.
5. Manual or audit-only candidates for ambiguous matches.

Rules:

- Only `verified` and `provider` aliases can drive automatic schedule matching.
- `heuristic` aliases can be stored for diagnostics but should not silently alter the user schedule unless promoted by a stronger signal.
- Cross-media title matching must stay blocked unless a durable alias connects the records.

### 3. Enrich Identities On Write Paths

When a show is added to the Library or imported:

- Ensure the `shows` row exists.
- Upsert direct identity aliases from the payload.
- Run bounded identity enrichment for the single show.
- Upsert the matching `feedProjections` row after enrichment.

This covers new tracking and import flows without scanning the whole Library.

### 4. Add Bounded Repair For Existing Data

Add internal actions for existing production data:

- `identity.enrichTrackedShowIdentity` for one user/show or one show.
- `identity.enrichTrackedShowIdentityPage` for a bounded page of tracked non-movie shows.
- Dry-run mode that reports candidate aliases and ambiguity before writing.

Initial production repair should:

- Start with active `watching`, `completed`, `paused`, and `plan_to_watch` TV/anime rows.
- Prioritize shows with schedule evidence in the next 120 days.
- Patch only shows that receive verified/provider aliases.
- Refresh only the affected `feedProjections`.

This is intentionally narrower than `dailyReconcileProjections`.

### 5. Add User Schedule Projections

Stop making `getUpcomingSchedule` and `getFutureUpcomingCountsForWatchlist` parse large global `scheduleCache` buckets and re-match providers on every read.

Add a compact per-user projection table:

```ts
userScheduleProjections: {
  userId: Id<"users">;
  showId: Id<"shows">;
  userShowId: Id<"userShows">;
  routeId: string;
  date: string;
  airDate?: string;
  sourceProvider: "tvmaze" | "anilist";
  sourceShowId: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeName?: string;
  showTitle: string;
  mediaType: "tv" | "anime";
  posterUrl?: string;
  availableAt?: number;
  updatedAt: number;
}
```

Required indexes:

- `by_user_date` on `userId`, `date`.
- `by_user_route_date` on `userId`, `routeId`, `date`.
- `by_user_show_date` on `userId`, `showId`, `date`.

Projection builder:

- Runs after schedule hydration for the requested range.
- Reads the user's non-movie `feedProjections`.
- Reads alias rows for those shows.
- Matches schedule entries by verified/provider aliases first.
- Falls back only to safe same-provider title matching already used today.
- Upserts per-user schedule rows and deletes stale rows for that user/date range.

Read path changes:

- `getUpcomingSchedule` reads `userScheduleProjections.by_user_date`.
- `getFutureUpcomingCountsForWatchlist` either reads `userScheduleProjections.by_user_route_date` or is replaced by denormalized future-count fields on `feedProjections`.
- Home Watchlist no longer scans global schedule JSON rows for every reactive query.

### 6. Add Schedule Signals To Feed Projections

Use `userScheduleProjections` to keep Home Watchlist correct even when provider totals lag.

When a matched schedule episode has aired or is about to air:

- Patch `userShows.newEpisodeSignalAt` and `feedProjections.newEpisodeSignalAt`.
- Optionally patch `feedProjections.nextAiringAt`, `nextAiringDate`, and `futureScheduledEpisodes`.
- Do not infer watched counts from schedule data.
- Do not mark a title complete or incomplete solely from schedule data.

This lets Home surface active titles with new schedule evidence before the user opens the detail route.

### 7. Metadata Freshness Should Be Event-Driven

Opening a detail route should stay useful, but it cannot be the only repair event.

Add a bounded freshness flow:

- When schedule projection finds a new aired episode for a tracked show, enqueue a targeted metadata refresh for that show.
- Run a daily low-volume refresh for active tracked shows with stale metadata and recent/future schedule evidence.
- Keep completed-title refresh, but extend the strategy to active `watching` and `paused` shows where schedule evidence says new episodes exist.
- Refresh projections for only affected shows.

Important guardrail:

- Do not call `rebuildUserShowTrackingAggregatesForUser` from routine metadata refresh.
- Recompute watched aggregates only through targeted user/show repair.

## Implementation Phases

### Phase 1: Data Model And Resolver

- Add `showIdentityAliases` schema and generated types.
- Implement alias upsert helpers.
- Implement one-show identity enrichment.
- Add provider lookup helpers needed for TMDB TV -> TVDB/IMDb/TVMaze and MAL -> AniList.
- Add dry-run output.

Acceptance criteria:

- Dr. STONE TMDB row can be enriched with an AniList alias or another provider-backed bridge to AniList.
- Ambiguous same-title cases are not auto-linked.
- Alias rows are idempotent.

### Phase 2: Existing Data Repair

- Add internal paginated repair action for tracked non-movie shows.
- Run dry-run on prod export first.
- Apply repair to high-confidence aliases only.
- Refresh affected `feedProjections`.

Acceptance criteria:

- No missing projection rows for tracked non-movie shows.
- Tracked shows with upcoming schedule evidence have provider aliases when available.
- Repair summaries show scanned, enriched, skipped ambiguous, and failed counts.

### Phase 3: User Schedule Projections

- Add `userScheduleProjections`.
- Add projection builder for one user/date range.
- Wire Home Schedule hydration to build projections after `hydrateScheduleRange`.
- Change `getUpcomingSchedule` to read user projections.

Acceptance criteria:

- Dr. STONE appears on May 14, 2026 in Schedule without opening the detail page first.
- The Beginning After the End still appears.
- One Piece anime does not attach to live-action ONE PIECE unless a verified alias exists.

### Phase 4: Watchlist Signals

- Use schedule projection rows to set `newEpisodeSignalAt`.
- Replace or narrow `getFutureUpcomingCountsForWatchlist`.
- Ensure Watchlist uses projection-backed future/available counts rather than scanning global schedule buckets.

Acceptance criteria:

- A newly aired tracked episode can surface on Home without a detail-route refresh.
- Watchlist still hides titles where only future episodes remain.
- Convex read bytes for Home Watchlist schedule counts drop materially from the current global schedule scan.

### Phase 5: Metadata Freshness

- Add targeted refresh triggered by schedule evidence.
- Extend daily refresh coverage beyond completed shows, but keep strict batch limits.
- Store refresh state so one problematic provider cannot loop endlessly.

Acceptance criteria:

- Active `watching` shows with new releases get refreshed without user navigation.
- Refresh does not scan every user's full Library.
- Logs show bounded read/write usage.

### Phase 6: Tests And Browser QA

Add Convex tests for:

- TMDB-tracked anime with verified AniList alias matches AniList schedule.
- TMDB-tracked anime without alias does not use unsafe cross-media title matching.
- Live-action ONE PIECE does not match anime One Piece.
- Stale metadata plus schedule evidence creates a Home signal.
- User schedule projections dedupe same episode from multiple sources.

Browser QA:

- Start from Home with a clean authenticated session.
- Verify Dr. STONE appears in Watchlist when an aired episode exists.
- Verify Schedule shows Dr. STONE on the correct date.
- Verify media filters still work for All, TV Shows, and Anime.
- Run the relevant `ui:inspect` sweep after UI changes.

## Observability

Add a data-quality audit script that reports:

- Tracked TV/anime shows missing all non-source aliases.
- Schedule entries in the next 120 days that look close to tracked shows but lack verified aliases.
- `feedProjections` whose `remainingEpisodes` differs from current `shows.releasedEpisodes - watchedEpisodesCount`.
- User schedule projection rows created, deleted, and skipped per run.
- Ambiguous candidate matches requiring manual review.

Add log summaries, not full payload dumps:

- `identity_enrichment`: scanned, enriched, skippedAmbiguous, failed.
- `schedule_projection`: userId hash or count only, range, created, updated, deleted, unmatched.
- `metadata_refresh_from_schedule`: show count, refreshed, throttled, failed.

## Production Rollout

1. Ship schema and resolver helpers behind internal actions.
2. Run dry-run on a fresh prod export.
3. Review ambiguous candidates manually.
4. Apply high-confidence alias repair in small batches.
5. Enable user schedule projection reads for Schedule only.
6. Enable Watchlist schedule signals.
7. Monitor Convex logs and database bandwidth.
8. Remove or heavily gate old global schedule scan paths after confidence is high.

## Known Risks

- Provider data can be incomplete or contradictory.
- AniList rate limits can slow enrichment if too much repair runs at once.
- Some TMDB TV anime entries may not have a reliable direct AniList bridge.
- Per-user schedule projections add writes during hydration, but they should reduce repeated high-cost reads.
- Heuristic aliases need careful guardrails to avoid false schedule entries.

## Definition Of Done

- Dr. STONE and similar TMDB-tracked anime appear in Schedule and Watchlist without detail-page repair.
- Newly released episodes can surface from schedule evidence even when provider totals lag.
- Same-name cross-media collisions are protected by verified/provider alias requirements.
- Home Watchlist and Schedule no longer depend on parsing broad global schedule cache rows on every read.
- Existing manual broad repair functions remain internal and are not used by routine app navigation.
