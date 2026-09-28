# ADR-0067: Franchise relation sync only extends tracked franchises

## Context and decision

The anime detail page ran a background `syncAnimeRelationsForRoot` for every
anime it opened, because `relationRootAnilistId` falls back to the title's own
AniList id. `applyAnimeRelationSync` inserts a `plan_to_watch` row for each
franchise entry that has none, so simply viewing an anime added it (as a
user-owned row, `isAutoTracked: false`) and its franchise (auto-tracked) to the
Library and Home's Haven't started. Only an explicit action should add a title
(ADR-0063).

Relation sync now only extends a franchise the user already tracks:

- The detail page runs the background sync only when the title is in the user's
  library.
- `syncAnimeRelationsForRoot` returns `skipped` without writes unless the user
  tracks the root show or a franchise entry (a `userShows` row carrying the
  relation root, or one for a show whose `rootAnilistId` is the root). Cached
  clients get the same result.

Explicit adds still go through `addAnimeToWatchlistWithRelations`, which tracks
the title and applies the franchise relation mode as before.

## Verification and rollback

On a local deployment: opening an untracked anime (The Elusive Samurai Season 2)
wrote no `userShows` rows; Add then tracked it (`isAutoTracked: false`) and its
franchise root (`isAutoTracked: true`). Before the fix, opening Black Clover
Season 2 without clicking wrote both rows.

Rows already created by past visits are indistinguishable from intentional adds
and are left alone; users can remove them from Library. Rollback is reverting the
page guard and the action guard together, which restores visit-time tracking.
