# ADR-0070: Caught-Up Detail Opens At The End

## Context

The show detail route auto-expanded the earliest season with unwatched episodes. When every season was watched, it fell back to expanding season 1. The quick rail only shows episodes from loaded seasons, so on a fully watched show it anchored at the end of season 1 (with season 2 prefetched) instead of the finale and the caught-up card. Opening Better Call Saul at 63/63 showed S01E09 to S02E01 in the rail and an expanded season 1 below it.

On mobile web, tapping a swipeable episode card also flashed its Unwatch and Rewatch actions. Those actions were always mounted behind the card, and the card's pressed style scales it down and lightens its background, which exposed them.

## Decision

When every season with a known episode count is fully watched, the detail route keeps all seasons collapsed and loads only the last such season for the quick rail. Shows with unwatched episodes keep expanding the earliest season that has them. Shows without any known season counts keep the season 1 fallback.

When every loaded rail episode is watched, the rail opens at its end, so the caught-up card is in view. Earlier seasons still load when the user scrolls left, using the existing prepend compensation from ADR-0028.

On mobile web, swipe actions are attached to the card's edges and slide in with it. They sit outside the card's clipped area at rest, so a tap reveals nothing, and they use solid fills so nothing shows through them. A released card eases to its open or closed position.

## Edge Cases

A season whose episode count includes unaired episodes still counts as unwatched, so a caught-up show with announced episodes keeps expanding that season and anchoring the rail on the next episode.

Watch progress, release availability, Home, and schedule paths are unchanged.

## Verification

Open a fully watched show such as `/show/tmdb:tv:60059`: every season is collapsed and the rail shows the finale and the caught-up card. Scroll the rail left and confirm earlier seasons load without jumping. Open a partially watched show and confirm the next season with unwatched episodes is expanded. On a touch device, tap an episode card and confirm no action colors flash; swipe it and confirm the action slides in attached to the card edge and still works.
