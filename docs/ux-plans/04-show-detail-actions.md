# Plan: Compact Show Detail Actions

## Problem

Show status and show-level actions take too much vertical space on the show detail page.

Browser inspection on `/show/tmdb%3Atv%3A615` confirmed the stack:

- `Watch Progress` card.
- `Tracking` card with current status, favorite state, status badge, and three full-width buttons.
- Separate row for `Mark All Watched` and `Add to List`.
- `Add to List` is visually separated from other show-level actions even though it belongs to the same action group.

This pushes episodes lower and makes the top of season/episode views feel action-heavy.

The deeper problem is fragmentation: watchlist, favorite, edit status, mark all watched, and add to list are all show-level actions, but the UI splits them across a large Tracking card and a separate action row.

## Current Code

- `components/ShowHeader.tsx`
- `app/show/[id].tsx`
  - Tracking card around the `Tracking` title.
- Full-width buttons:
    - add to library / remove from library
    - favorite
    - edit status
  - Separate action row:
    - mark all watched
    - add to list
- `components/AddToListModal.tsx`

## Recommended Solution

Move all common show-level actions into one consistent compact action surface. Do not keep separate rows for actions that operate at the same show level.

Proposed mobile layout:

- Floating hero top-left: back button.
- Floating hero top-right or below hero: compact action icons:
  - watchlist/status
  - favorite
  - more/status menu
  - list
- Progress remains a compact section, but Tracking card becomes a concise status row or collapsible action menu.
- For already-tracked TV/anime, remove the standalone Tracking card unless a specific explanatory state is needed.

Proposed desktop layout:

- Keep actions near the hero/title metadata row.
- Use icon+short-label buttons in a horizontal toolbar.
- Keep status as a badge plus one action button/menu.

## Action Model

Use a single `ShowActionBar` component:

```ts
type ShowActionBarProps = {
  statusLabel: string;
  isTracked: boolean;
  isFavorite: boolean;
  canMarkAllWatched: boolean;
  canAddToList: boolean;
  isBusy: boolean;
  onToggleWatchlist: () => void;
  onToggleFavorite: () => void;
  onEditStatus: () => void;
  onMarkAllWatched: () => void;
  onAddToList: () => void;
};
```

Actions:

- Status: opens the existing status modal.
- Library membership: add to library / remove from library. Do not label removal as "Remove from Watchlist" because Watchlist is the Home surface, not the full saved/tracked collection.
- Remove from Library should confirm when the title has progress, tracking state, or custom-list membership that could be lost.
- Favorite: heart icon.
- Mark all watched: visible only for TV/anime with seasons and not fully watched.
- Add to list: treat as a normal show-level action. It may move into an overflow pattern if all actions use that pattern, but it should not be hidden by default.
- All of these belong to the same show-level action surface, not separate card/row clusters.

## Implementation Steps

1. Add `components/ShowActionBar.tsx`.
2. Move current action handlers from the inline show detail JSX into props.
3. Replace the full `Tracking` button stack and the separate `Mark All Watched` / `Add to List` row with compact `ShowActionBar`.
4. Keep status modal behavior unchanged.
5. Keep `AddToListModal` unchanged initially; only change its trigger visibility/placement.
6. Remove duplicated separate action row after the action bar covers mark-all/list.
7. Verify backend removal behavior before final copy so the confirmation explains what will be removed.

## UX Decisions To Test

- Whether `Edit Status` should be a status badge button or an overflow-menu item.
- Whether `Mark All Watched` should be a primary visible icon or overflow action.
- Whether all secondary show actions belong in an overflow/menu pattern on small screens.
- Whether **Remove from Library** should remain text-labeled to reduce accidental taps.
- Whether untracked titles need a larger first-save surface before collapsing into the compact action bar.

## Verification

- `/show/tmdb%3Atv%3A615` mobile width:
  - Episodes should move higher on the screen.
  - Actions should be clear without taking a full card stack.
- Movie detail route:
  - Movie watch action should still be obvious.
- Anime detail route:
  - Franchise controls should remain discoverable and not be squeezed into the main action strip.

## Risks

- Icon-only controls can become unclear without labels/tooltips/accessibility labels.
- Hiding list actions too aggressively could hurt custom-list workflows.
- Removing the explanatory Tracking card may reduce clarity for first-time users.
