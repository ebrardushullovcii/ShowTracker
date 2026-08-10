# ADR-0058: Canonical Provider Alias Coordinates

## Status

Accepted

## Context

On August 10, 2026, production Home showed `Futurama` as active with `2 left`
after the user marked the newly released episode watched. Detail showed `157/157`
released episodes watched. The feed projection also had
`watchedEpisodesCount: 157`, `remainingEpisodes: 0`, and an exact TMDB watched
anchor for `S11E03`.

The schedule-confidence catalogue contained the same August 3 and August 10
episodes from both providers. TMDB identified them as `S11E02` and `S11E03`;
TVMaze identified them as `S14E02` and `S14E03`. Release-fact duplicate collapse
correctly preferred TVMaze's precise airtimes, but also retained TVMaze's season
coordinates. The schedule cache and user projections then treated both rows as
different from the exact TMDB watched anchors.

ADR-0057 prevents an older provider alias from restoring a caught-up signal.
It intentionally allows a release timestamp after `lastWatchedAt`. That is the
correct default, but it cannot recognize an episode the user marked watched
before its provider airtime.

## Current Behavior

Before this decision:

- same-day provider rows could collapse to the more precise TVMaze event;
- the chosen row supplied both release timing and episode coordinates;
- watched matching remained exact and therefore did not match TMDB `S11E03`
  against TVMaze `S14E03`;
- a user who watched early could appear to have both the prior alias and the
  new alias left, despite a zero remaining count.

## Decision

Release-fact deduplication separates timing authority from episode-coordinate
authority for a narrowly verified cross-provider alias.

When two rows are for the same tracked TV title, have the same schedule date,
come from different providers, and match by either the same non-generic episode
name or the same episode number:

- duplicate selection continues to choose the preferred timing row;
- if one row is the direct TMDB event for the tracked TMDB show, its season,
  episode number, and name become the canonical projected coordinates;
- the selected row's provider, precise `airDate`, and `airTimestamp` remain the
  release-timing evidence.

Raw provider events are not rewritten. The canonical coordinates are attached
only to the deduplicated release-fact row and flow into release facts, schedule
cache maintenance, and user schedule projections. After pairwise duplicate
selection, a final pass recovers canonical coordinates from the original raw
TMDB rows. This prevents an older cross-provider same-number collision from
removing the current TMDB alias before its same-day row is processed.

## Reasoning

The tracked route and watched anchors use TMDB coordinates, so downstream
schedule facts must use the same coordinate system for exact matching. TVMaze
still contributes valuable clock-time precision. Keeping those two kinds of
authority separate prevents a precise timestamp from silently changing episode
identity.

This is safer than treating all same-day rows as watched, remapping coordinates
inside Home, or hiding every caught-up show with a positive schedule count. The
alias must be established at the provider reconciliation boundary, and watched
matching remains exact after canonicalization.

## Provider/Data Assumptions

TMDB is the canonical episode-coordinate source for a tracked `tmdb:tv` route.
TVMaze may number returning seasons differently while describing the same
episode and supplying a more precise airtime.

Same normalized non-generic names on the same date are strong alias evidence.
Equal episode numbers on the same date are also sufficient when season numbers
differ. A direct TMDB provider ID match is required before TMDB coordinates are
attached.

## Edge Cases

Same-source duplicates retain the existing behavior. Cross-provider rows on
different dates are not canonicalized. Rows with different episode numbers and
different non-generic names do not borrow TMDB coordinates, even if an existing
same-day duplicate rule selects one of them.

Anime and non-TMDB routes are unchanged. Same-day multi-episode drops retain
their existing adjacent-episode protections. A genuinely new TMDB episode that
has no watched anchor remains actionable after canonicalization.

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

The regression fixture uses Futurama-shaped TMDB `S11E03` and TVMaze `S14E03`
rows, an older TVMaze `S11E03` collision, and a third-provider replacement. It
asserts that the result retains TVMaze's precise airtime and source while
recovering TMDB `S11E03` and its name from the original provider rows.

Production verification must snapshot the active and paused Home rows before
deployment, run the schedule-confidence service on the VPS, confirm Futurama's
release facts and user projections use TMDB coordinates, and verify that only
Futurama leaves the active Watchlist while every other active and paused title
remains.

## Rollback Notes

Rollback the canonical-coordinate attachment and `episodeFromEvent` fallback
together. Raw provider events require no migration. Before rollback, preserve
the affected release fact, schedule cache rows, user projections, watched
anchors, and provider rows so a coordinate-alias regression can be compared
without broad account repair.
