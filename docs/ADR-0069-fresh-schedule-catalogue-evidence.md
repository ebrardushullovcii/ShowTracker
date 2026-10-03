# ADR-0069: Fresh schedule catalogue evidence

## Context

On October 1, 2026, Delicious in Dungeon had a removed TVMaze S02E01 entry
in Convex's shared schedule cache after that entry had already disappeared
from the VPS SQLite cache. Fresh TVMaze data contained only season 1; TMDB's
season 2 date was October 1, 2027. SQLite-only pruning could not rediscover
the orphan, so Home still showed an available episode.

Hot Ones had a different problem: TVMaze published an unannounced weekly
`TBA … While Eating Spicy Wings` placeholder beyond TMDB's freshly hydrated
season catalogue. Its timestamp passed, but the detail page had no such
episode to mark watched. A timestamp alone was not sufficient release evidence.

## Decision

The nightly reconciler retains successful TMDB/TVMaze catalogue evidence in
the existing VPS SQLite database. Evidence is usable for at most 36 hours and
must come from the latest reconciliation pass. Empty or failed responses cannot
renew old proof or authorize cleanup in that pass. AniList next-airing responses
are not complete catalogues and remain excluded from absent-row pruning.

The existing paginated schedule-cache export is checked against this evidence.
Entries absent from their own provider catalogue produce exact provider,
date, season, and episode cache-only prunes, including when SQLite no longer
contains the stale entry. Convex reads only those indexed date buckets and
preserves another provider's valid entry and the same episode on a moved date.
Cache-only prunes bypass show and tracking updates; normal nightly projection
generation then rebuilds the user windows from the corrected cache.

TVMaze names beginning with `TBA`, `TBD`, or `To be announced` are excluded
from release facts and schedule projection inputs when the corresponding
TMDB season was freshly hydrated and lacks that episode. A named TVMaze-only
episode, a generic `Episode N` name, an unhydrated season, or a placeholder
whose canonical episode does exist retains existing provider policies.
Fresh provider data can restore an episode once it is announced or confirmed.

Cache cleanup also preserves ADR-0058's verified canonical episode aliases.
An entry can retain TVMaze's provider ID and precise airtime while using TMDB's
season/episode coordinates. It is not an orphan merely because those coordinates
are absent from TVMaze's raw catalogue. The same-pass raw rows from both fresh
catalogues must establish the same-date alias under the existing name/number
matching rules. Old evidence, a moved date, or an unrelated TMDB episode cannot
protect a removed provider entry. Affected cache facts can be restored through
the existing cache-only maintenance path without changing tracking state.
For TMDB-tracked TV titles, a missing or failed canonical-provider refresh defers
TVMaze catalogue cleanup until fresh TMDB evidence is available; raw TVMaze
coordinate absence alone cannot disprove a canonical alias.

This adds no app-navigation repair, subscription, Convex table, or frequent
timer work. Watched history, manual statuses, companion names, and airtime
settings are unchanged. ADR-0037's provider-disappearance rule and ADR-0033's
date-move rule continue to apply.

## Verification and rollback

Regression tests cover orphan cache entries without any SQLite event,
confirmed versus unconfirmed placeholders, named provider-only episodes,
incomplete hydration, expired evidence, exact dates, and unchanged tracking.
Run `npm run schedule-confidence:validate`, `npm run test:schedule-confidence`, TypeScript, lint, and
the Convex development push; then run nightly reconciliation and verify Home
against production. Roll back the code together if needed; retain watched
history and the corrected current provider data.
