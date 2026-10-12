# ADR-0072: Unwatch An Episode And Everything After It

## Context

Marking an episode watched already offers to mark the earlier released episodes too. The reverse was missing: when a run of episodes was marked watched by mistake, each one had to be unwatched separately, or a whole season or show had to be cleared.

## Decision

When the user unwatches an episode and later episodes of the same title are marked watched, the detail route offers "Mark This & Later Not Watched" next to "Mark Not Watched". Tapping a watched episode shows it in the existing Watch Options sheet. The Unwatch swipe opens the same sheet without Rewatch, and only when later watched episodes exist; otherwise it unwatches the single episode immediately as before.

The `unmarkEpisodesWatchedFrom` mutation deletes the chosen episode and every later watched row of that title on the server, so seasons the client has not loaded are included. Order is season, then episode. Specials (season 0) are outside the main run: unwatching a regular episode never removes specials. The mutation reuses the single-episode unwatch rules: a Completed title returns to Watching, and the tracking aggregate refresh re-derives status and updates the Home projection.

## Edge Cases

Anime franchise entries are separate titles, so other seasons stored as their own AniList titles are not touched. The count in the sheet comes from loaded season keys and the per-season progress query, which ignores rows outside known show bounds; the server also removes those rows when they fall after the chosen episode, and the confirmation notice reports the server's count.

## Verification

Open a show with several watched episodes, tap a watched episode in the middle, choose "Mark This & Later Not Watched", and confirm that episode and every later one, including later seasons, show as unwatched while earlier episodes stay watched. Swipe Unwatch on the last watched episode and confirm it unwatches without a sheet.
