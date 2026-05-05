# Plan: Episode Collapse and Expand Icons

## Problem

Season accordion collapse/expand affordance is currently a rotating text glyph (`▼`) beside the watch-state circle. Browser inspection showed it reads as a small black triangle at the far right and competes with the season watched control.

The exact issue:

- The icon is visually weak and not clearly related to the row action.
- The mark-season circle is more prominent than the expand/collapse affordance.
- The season row has two actions: expand row and mark season watched. Their affordances need clearer separation.
- The season watched action should stay visible; the problem is the current chevron is ugly, tiny, and barely visible.

## Current Code

- `components/SeasonAccordion.tsx`
  - Uses `Animated.Text` with `▼`.
  - Mark-season radio/check action sits immediately before the chevron.

## Recommended Solution

Replace text glyphs with real icons from `@expo/vector-icons`.

Recommended icon pattern:

- Collapsed: `chevron-down`
- Expanded: `chevron-up`
- Use `Feather` or `Ionicons`, matching nearby app icon usage.
- Prefer a polished contained chevron control if it improves visibility, but the exact style can be decided during implementation.
- Add `accessibilityLabel={isExpanded ? "Collapse season" : "Expand season"}` on the season header pressable.

Also improve action separation:

- Keep the whole row tappable for expand/collapse.
- Keep mark-season as a separate icon button with `event.stopPropagation()`.
- Add a small gap or divider between mark-season and chevron.
- Consider moving mark-season into a trailing secondary action slot and chevron to the outermost edge.
- Do not move mark-season into the show-level action bar; it is a season-local action.

## Implementation Steps

1. Replace `Animated.Text` glyph with animated icon container.
2. Use `Ionicons name={isExpanded ? "chevron-up" : "chevron-down"}` first; if animation is desired, animate the container rotation while rendering one icon.
3. Add explicit accessibility labels/states:
   - Header: `accessibilityRole="button"`, `accessibilityState={{ expanded: isExpanded }}`
   - Mark action: `accessibilityLabel={isFullyWatched ? "Mark season unwatched" : "Mark season watched"}`
4. Tune spacing so mark action and expand icon do not feel like one compound control.
5. Verify loaded and unloaded season states.

## Verification

- `/show/tmdb%3Atv%3A615`, Seasons & Episodes:
  - Collapsed seasons should clearly show expand direction.
  - Expanded Season 7 should clearly show collapse direction.
  - Mark-season button should not accidentally expand/collapse.
  - Row tap should still expand/collapse.

## Risks

- If the icon is too subtle, the row still depends on hidden tap behavior.
- If the mark-season control remains too close, users may tap the wrong action.
