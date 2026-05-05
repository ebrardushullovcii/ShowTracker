# Plan: Tabs, Filters, and Swipe Navigation

## Problem

Home, Library, and Discover all use `SegmentedControl` for controls that are visually tab-like. Home also stacks a second segmented control directly below the first for media filtering. Library and Discover use the same segmented treatment for media type filters, then place status/filter chips below.

Browser inspection confirmed the issue:

- `/home`: `Watchlist / Schedule` and `All / TV Shows / Anime` look like the same control type even though one changes the page mode and the other filters content.
- `/library`: `All / TV Shows / Anime / Movies` is conceptually a media type filter, but it looks like section navigation and sits close to status filter chips such as `All 116`, `Watching 19`, `Planned 9`.
- `/discover`: media type filters and filter dropdown pills sit close together and compete visually.

The exact UX problem is not only styling. The app currently mixes two concepts:

- Section navigation: changes the visible view or content dataset.
- Filtering: narrows the current dataset.

Domain decisions:

- `All / TV Shows / Anime / Movies` is a **Media Type Filter** everywhere, not canonical section navigation.
- A **Media Type Filter** is single-choice everywhere; `All` resets it.
- `Watchlist / Schedule` is a **Home Mode** switch, not a filter.

## Current Code

- `components/SegmentedControl.tsx`
- `components/FilterChipGroup.tsx`
- `app/(tabs)/home/index.tsx`
- `app/(tabs)/library/index.tsx`
- `app/(tabs)/discover/index.tsx`

## Recommended Solution

Create two distinct control patterns:

1. `HomeModeSwitch`
   - For the Home `Watchlist / Schedule` mode only.
   - Visual treatment: full-width row, flatter surface, stronger selected indicator, less pill-like.
   - Accessibility: use `accessibilityRole="tablist"` on the container and `accessibilityRole="tab"` with `accessibilityState={{ selected }}` on options.
   - Used for:
     - Home `Watchlist / Schedule`

2. `FilterBar`
   - For narrowing the active view.
   - Visual treatment: horizontal chip rail, count badges, dropdown chips, smaller height.
   - Accessibility: keep chips as buttons or toggle buttons, not tabs.
   - Media type filters use single-choice behavior even when they look like chips.
   - Used for:
     - Home media type filter.
     - Library media type/status/genre/year/rating controls.
     - Discover media type/genre/year/rating controls.

For Home specifically, avoid two stacked segmented controls. Prefer one of these:

- Option A: Home top section switch for `Watchlist / Schedule`; media type becomes a compact filter chip rail underneath.
- Option B: Replace `Watchlist / Schedule` segmented control with a two-item header action/nav row, then keep media type as the only segmented control.
- Option C: Separate pages/routes for watchlist and schedule later, if the interaction keeps feeling like real navigation.

Option A is the safest first pass because it keeps state and routes unchanged while making the hierarchy clearer.

## Mobile Swipe Navigation

Add swipe between Home Modes as part of the first cleanup pass.

Scope:

- Home: allow horizontal swipe between `Watchlist` and `Schedule` on mobile only.
- Do not make media filters swipeable.
- Do not add swipe to Library/Discover initially because horizontal filter rails and grid scrolling already create more gesture conflict.

Implementation approach:

- Use `react-native-gesture-handler` and `react-native-reanimated`, already present in the project.
- Add a small reusable `useHorizontalSectionSwipe` hook or `SectionPager` component.
- Enable only on native mobile layouts. Do not enable this gesture on web by default.
- Disable or ignore swipe when the gesture starts inside horizontal `ScrollView` filter rails.
- Keep button/tab controls as the primary, accessible interaction.

## Implementation Steps

1. Add a new `components/HomeModeSwitch.tsx` or a generic `ModeSwitch` if another true mode switch appears.
2. Update only Home `Watchlist / Schedule` to `HomeModeSwitch`.
3. Move media type controls into filter styling across Home, Library, and Discover.
4. Keep `FilterChipGroup` for status/filter chips, but add a variant or wrapper for dropdown chips so all filters share one visual language.
5. Refactor Home so `Watchlist / Schedule` is section navigation and `All / TV Shows / Anime` is visibly a filter.
6. Add mobile-only swipe between Home Modes in the same implementation pass.
7. Run visual checks for `/home`, `/library`, and `/discover`.

## Verification

- In-app browser:
  - `/home`: tabs and filters must no longer look like duplicate controls.
  - `/library`: status chips should read as filters, not top-level tabs.
  - `/discover`: media sections and filter chips should have clear hierarchy.
- Accessibility:
  - Screen reader roles should distinguish tabs from filter buttons.
  - Selected states must be exposed.
- Regression:
  - `npm run ui:inspect:quick`
  - `npx expo lint`

## Risks

- Swipe gestures can conflict with horizontal rails and native back gestures.
- Renaming/replacing shared controls can affect multiple screens at once.
- Web trackpad horizontal scrolling can feel accidental; keep swipe mobile-first.
