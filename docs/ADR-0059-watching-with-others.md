# ADR-0059: Watching with others as an orthogonal watchlist mode

## Context

Some tracked series are watched with friends or a partner. Marking those titles
as Paused makes the existing Home queue inaccurate, while leaving them in the
normal active queue makes the queue noisy and does not preserve the shared-watch
context.

## Current behavior

`userShows.status` and the denormalized `feedProjections.status` use a fixed
status set: Watching, Paused, Dropped, Completed, and Planned. Home derives its
active, paused, and not-started sections from those statuses and release-aware
projection fields. Episode mutations and the inactivity job update the existing
status and projection fields.

## Decision

Keep the existing status enum unchanged. Add optional synced fields to both
`userShows` and `feedProjections`:

- `watchingWithOthers: boolean` marks the shared-watch mode.
- `watchingWithNames: string[]` stores up to five trimmed, case-insensitively
  deduplicated names, each capped at 40 characters.

The authenticated `setWatchlistStatus` mutation accepts the optional mode and
names in the same transaction as the status change. Any status other than
Watching clears the companion fields. Selecting ordinary Watching also clears
the mode; selecting Watching with others sets the marker and may provide no
names.

Home reads one dedicated Watching with others section between active and Paused.
The section uses a dedicated compound projection index plus the same media
filter, bounded limits, stable feed behavior, anime-franchise selection, and
route IDs as the other sections.
Rows in the mode are excluded from the normal active section. Cards show compact
name chips when names exist and expose the complete names through accessibility
labels. The detail status editor offers the mode and an optional comma-separated
name field.

Home also removes matching route IDs from the same-day schedule-attention merge.
Those schedule rows do not carry companion metadata themselves, so route-level
exclusion prevents a title airing today from appearing in both Active and the
Watching with others section.

Episode marking/unmarking preserves the mode while the underlying status remains
Watching. A transition to Completed or another non-Watching status clears it.
The inactivity and anime-franchise auto-pause paths explicitly skip Watching
rows in this mode.

## Reasoning

An orthogonal marker avoids widening every status validator and avoids changing
schedule, release, completion, and library semantics. Denormalizing the marker
and names into projections keeps Home bounded and reactive without user-specific
joins. Clearing metadata on ordinary status changes prevents stale group labels
when a title leaves the shared-watch queue.

## Provider/data assumptions

The mode is user-owned metadata and does not depend on TMDB, TVMaze, AniList,
Jikan, schedule confidence, air dates, provider matching, or release totals.
Existing optional schema fields allow old rows and externally-created projection
rows to remain valid. Provider refreshes rebuild projections from the user row,
preserving the mode.

## Edge cases

- Empty, whitespace-only, duplicate, and overlong names are normalized server-side.
- More than five names are truncated deterministically in input order.
- Leaving the mode clears both the marker and names.
- A mode row remains underlying Watching for Library and tracking logic.
- Mode rows are not auto-paused for inactivity.
- A same-day release remains visible only in Watching with others, not as a
  duplicate Active card.
- Movies do not expose the mode in the detail editor.
- Missing provider route identifiers are still excluded by the existing Home
  hydration guard.

## Verification

- TypeScript compilation covers schema, Convex mutation/query contracts, and
  Home/detail UI types.
- Focused tests should verify normalized names, atomic status transitions,
  projection propagation, active-section exclusion, dedicated-section media
  filtering, and auto-pause exclusion.
- Production verification must snapshot active and paused rows before and after
  deployment, then verify the shared-watch section and all requested names in the
  authenticated Browser session.

## Rollback notes

Revert the feature commit and deploy the previous application/backend versions.
The new fields are optional, so old code continues to read existing rows and
ignores the metadata. If only the UI needs rollback, leaving the fields in the
schema is safe; a later cleanup may remove them after all rows are cleared.
