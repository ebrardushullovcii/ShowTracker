# ADR-0054: Terminal Provider Count And Projection Repair

## Status

Accepted

## Context

On July 15, 2026, the production Home Watchlist again surfaced completed shows
after the nightly schedule-confidence run. `Magi`, `Attack on Titan`, `Naruto:
Shippuden`, `Death Note`, and `The Grim Adventures of Billy & Mandy` showed
positive remaining counts, then disappeared as soon as their detail routes
refreshed provider metadata.

The preserved pre-detail production export exposed three related failures.
TMDB and TVMaze catalogues were counted as additive when their titles or episode
grouping differed. Terminal TMDB summary arithmetic could combine prior-season
counts with an absolute episode number. Finally, a stale feed projection could
carry an old provider identity or watched aggregate into reconciliation, while
delta application found a show indirectly by provider ID.

The first production rollout exposed another boundary failure before any
remaining detail page was opened: pending deltas were stored only by provider
canonical key. A later healthy user row for the same provider show could
overwrite an earlier user's aggregate or projection repair evidence.

## Current Behavior

Before this decision:

- Cross-provider episode rows could raise a terminal release count above either
  provider's own complete catalogue.
- A terminal TMDB show with incomplete season hydration could use summary math
  that inflated `Naruto: Shippuden` from `500` to `913` episodes.
- TVMaze alternate grouping could override a complete TMDB regular-episode count,
  as with `Attack on Titan` at `89` instead of `87`.
- An imported remaining floor could restore an already disproved inflated count.
- Reconciliation exported stale projection provider fields and removed the exact
  Convex `showId` before applying deltas.
- Actual watched anchors could exceed a stale cached watched aggregate without
  scheduling an aggregate repair, as with `Death Note` at `37` anchors but `11`
  watched in Home.

## Decision

For terminal TV shows, schedule-confidence hydrates every positive regular TMDB
season when the show summary can produce an absolute-numbering risk. When that
hydration is complete, TMDB's dated regular episode count is authoritative over
alternate TVMaze grouping, cross-provider row unions, raw totals, and imported
remaining floors.

The Convex export uses current global show metadata for provider identity and
marks stale feed projections for bounded repair. It also marks a tracking
aggregate for repair when unique exported watched anchors exceed the cached
watched count.

Release deltas retain the exact Convex `showId`. Delta application targets that
show first and uses provider-ID lookup only as a fallback for schedule-only rows
that have no tracked show ID. If aggregate repair proves the user caught up
during the same mutation, terminal completion is applied immediately.

SQLite stores pending deltas by provider canonical key plus exact Convex
`showId`, so repair evidence from one tracked show cannot be overwritten by a
different show record. Repair flags are carried forward while that show's delta
is pending, so a later healthy user row cannot erase an earlier user's repair
evidence. The public payload keeps the provider canonical key.

For an already caught-up terminal row, positive TMDB released and total counts
at or below the watched count remain authoritative even when complete hydration
was not otherwise necessary. This prevents alternate TVMaze grouping from
reactivating an otherwise correct `87/87` row.

When terminal TMDB and TVMaze counts disagree and TMDB hydration is still
partial, reconciliation immediately hydrates every regular TMDB season and
resolves the mismatch from that complete catalogue. This makes provider count
authority independent of which user's projection is processed last.

Complete hydrated TMDB counts deduplicate by regular `season:episode` identity.
Duplicate provider rows for alternate final-chapter presentations therefore do
not inflate the authoritative count above the detail catalogue.

Once established, that terminal TMDB authority is applied after all TVMaze and
anime-provider metadata merges. A later provider merge cannot silently restore
the larger alternate catalogue.

The authoritative marker also prevents an alternate imported watched count from
raising the provider denominator. Watch history can remain stored for statistics
without turning an `87`-episode regular catalogue back into `89` Home episodes.

## Reasoning

Provider catalogues are alternative representations, not episode sets to add
together. A complete regular-season catalogue is stronger evidence for Home
progress than title-sensitive cross-provider dedupe or show-level summary math.

The exact exported show ID preserves the identity boundary between SQLite and
Convex. Repair flags remain evidence-driven and scoped to one show, avoiding the
broad navigation-triggered repair that previously made the symptom disappear
only after opening detail.

## Provider/Data Assumptions

TMDB regular season detail excludes season `0` specials from normal Watchlist
progress. For a terminal TMDB show, complete successful hydration of every
positive regular season is authoritative for released regular episodes.

TVMaze remains useful for dates, airtimes, and fallback catalogue evidence, but
its alternate grouping does not enlarge a fully hydrated terminal TMDB count.
Provider-ID fallback remains necessary for untracked schedule rows.

## Edge Cases

Partial or failed TMDB hydration keeps the existing conservative provider and
summary fallbacks. Ongoing shows retain their multi-provider release handling.

A terminal show can still have a larger catalog total than released regular
episode count, such as `161/184`; a caught-up user is hidden because Home uses
the released denominator, while the catalog total remains available for detail.

When watched anchors are truncated by the export limit, repair is requested only
if the visible unique anchors already exceed the cached count. Equality does not
claim that the aggregate is complete.

Multiple users tracking the same provider show produce distinct pending delta
rows when their exact Convex show identities differ. When they share one show
identity, pending repair flags are merged until apply. A repair flag is therefore
not lost when a later user has a healthy projection for the same provider show.

## Verification

Required checks:

```bash
npm run schedule-confidence:validate
node --check scripts/schedule-confidence.mjs
npx tsc --noEmit --pretty false
npm run lint
git diff --check
npx convex deploy --dry-run --yes
```

Production-shaped replay fixtures cover cross-provider duplicate rows, alternate
episode grouping, terminal summary inflation, exact show targeting, stale feed
projection repair, and watched-anchor aggregate drift.

After deployment, run the VPS schedule-confidence service and verify live Home
hides Magi, Attack on Titan, Naruto: Shippuden, Death Note, and Grim while
preserving genuinely unfinished rows such as Ozark.

## Rollback Notes

Rollback by removing complete terminal TMDB authority, repair flags, and exact
show targeting together. Before doing so, preserve a production export and
confirm that the candidate provider catalogue really represents additional
regular episodes rather than alternate grouping, specials, or stale metadata.
