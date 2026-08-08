# ADR-0057: Caught-Up Schedule Alias Signal Boundary

## Status

Accepted

## Context

On August 8, 2026, production Home showed `Futurama` as active with `1 left`
even though detail and the reconciler agreed that the user had watched all 156
released regular episodes. The user had already removed and re-added the show,
refreshed metadata, and re-marked the released episodes without changing the
result.

The preserved production state showed that schedule-confidence correctly wrote
`remainingEpisodes: 0` and cleared stale attention. Opening Home then ran the
cached schedule signal sync and restored `newEpisodeSignalAt` to exactly
`lastWatchedAt + 1`.

The surviving August 3 schedule row was TVMaze `S14E02`, while the watched
episode was stored from TMDB as `S11E02`. Both providers describe `Catfish
Hunter`, but they number Futurama's returning seasons differently. The cached
schedule had already collapsed the same-day provider rows to the TVMaze
coordinate, so exact watched-coordinate matching could not neutralize it.

## Current Behavior

Before this decision:

- schedule-confidence could correctly prove a returning show was caught up;
- Home's recent cached-schedule scan could independently reinterpret an older
  provider-season alias as unwatched;
- signal application raised the old release to `lastWatchedAt + 1`, making the
  stale row look newer than the user's watch action;
- the next reconciler run cleared the signal, but the next Home sync could add
  it again.

## Decision

A cached schedule release is not actionable when all of these are true:

- the current feed projection has a numeric `remainingEpisodes` value at or
  below zero;
- the cached release timestamp is at or before `lastWatchedAt`.

The rule is applied while building cached-schedule matches and again inside the
signal mutation. The mutation check is authoritative for races where projection
state changes between query and write. Rejected matches are not counted as
valid signals, so the existing stale-signal cleanup can clear them.

The rule does not compare or rewrite provider season numbers. Provider-specific
coordinates remain available for Schedule and detail display.

## Reasoning

`remainingEpisodes: 0` is compact evidence from the release reconciliation
layer that no released regular backlog remains. A cached release older than the
user's final watch cannot override that evidence merely because another
provider uses a different season coordinate.

This boundary is narrower than treating same-title or same-day episodes as
watched. It does not guess that TMDB `S11E02` always equals TVMaze `S14E02`, and
it leaves the existing duplicate and exact-coordinate rules intact for rows
whose released backlog is still positive.

## Provider/Data Assumptions

TMDB and TVMaze may assign different season numbers to the same returning
season. Schedule cache maintenance may retain only one provider's coordinate
after duplicate collapse.

The feed projection's remaining count represents released regular episodes,
not future episodes or season-zero specials. `lastWatchedAt` is the user's most
recent persisted watch action for the tracked show.

## Edge Cases

A genuinely new episode released after `lastWatchedAt` remains actionable even
when the prior projection was caught up. An older skipped episode remains
actionable when `remainingEpisodes` is positive. Rows with no numeric remaining
count keep the previous matching behavior rather than assuming they are caught
up.

For same-day date-only releases, existing watchlist airtime mode still controls
availability. This rule only rejects a row after the projection says caught up
and the user's watch timestamp is not earlier than the cached release signal.

## Verification

Required checks:

```bash
npx tsx --test lib/tracking/home-schedule-signal.test.ts
npm run schedule-confidence:validate
npx tsc --noEmit --pretty false
npm run lint
git diff --check
npx convex deploy --dry-run --yes
```

The regression fixture covers Futurama-shaped TMDB/TVMaze season aliases, a
real new release after the last watch, a real older skipped backlog, and the
unknown-count fallback.

Production verification must preserve the pre-change watching and paused row
sets, hide only caught-up Futurama, run the VPS reconciler, and confirm that a
subsequent Home cached-schedule sync does not restore it.

## Rollback Notes

Rollback the shared signal policy and both call sites together. Before rollback,
preserve the projection, cached schedule row, watched anchor, and timestamps for
any show that failed to surface so the provider alias can be distinguished from
a genuinely newer release.
