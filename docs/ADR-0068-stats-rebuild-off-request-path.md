# ADR-0068: Profile statistics are rebuilt in the background, never on the request path

Revises ADR-0048.

## Context

ADR-0048 made tracking changes delete the materialized `userStats` row so Profile fell back to a live
calculation instead of showing old totals. That live calculation read every `userShows` row, every
referenced `shows` document and up to 10,000 `watchedEpisodes` rows in a single query. On a large
library (634 shows and a long watch history) it failed with "Your request timed out performing too
many system operations", which crashed Profile after any tracking change. `stats.rebuildUserStats` did
the same scan in one mutation and could not recover it either.

## Decision

- `stats.getUserStats` only reads the cached row (three indexed reads). With no row it returns `null`.
- Tracking changes keep the cached row and set `staleAt`. Only the first change after a rebuild is
  scheduled writes, so bulk tracking does not rewrite the row per episode.
- Profile asks for a rebuild with `stats.requestUserStatsRebuild` when stats are missing or stale,
  once per cached version. It keeps showing the last totals with an "Updating with your latest
  activity" note, or a "Calculating your stats" loader when there are none yet.
- `stats.rebuildUserStatsInBackground` pages `userShows` (100 per query, with their `shows`) and the
  most recent 10,000 `watchedEpisodes` rows (1,000 per query), then writes the row through
  `stats.writeUserStats`. A change that lands after the rebuild started keeps the row stale so
  Profile asks once more.
- `rebuildUserStats` (Settings refresh, end of TV Time import) schedules the same rebuild.
- `rebuildScheduledAt` debounces requests; a scheduled rebuild that has not written after 10 minutes
  is treated as lost and can be requested again.

## Reasoning

Stats are derived and can lag a tracking change by seconds, as long as Profile says so; they cannot
be allowed to fail. Paged internal queries stay far below per-function read and time limits no matter
how large the library grows, and the rebuild only runs when someone looks at Profile after a change,
so ordinary tracking adds no rebuild cost. The totals and streak rules are unchanged from ADR-0048 and
ADR-0049.

## Verification and rollback

On the dev deployment, `rebuildUserStatsInBackground` wrote the row and cleared both markers. On
production, the account that hit the timeout loads Profile from the cached row and refreshes it in the
background after marking an episode watched.

Rollback is restoring the live calculation in `getUserStats` and deletion in
`invalidateUserStatsCache`, which brings back the timeout on large libraries.
