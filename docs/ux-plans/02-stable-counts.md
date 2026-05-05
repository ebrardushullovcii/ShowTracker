# Plan: Stable Counts During Loading

## Problem

Counts and count-like values in the same UI position can briefly show `0` or otherwise jump while Convex queries, filters, mode switches, or local enrichment are refreshing. The visible result feels like the value became zero even when the app is only changing context.

The first concrete repro is switching Home from `Watchlist` to `Schedule`, where the value in the same header area can drop before the next value is ready. This is a **Display Pair** issue: if the label changes from `matched` to `episodes`, the label and value should swap atomically.

Browser inspection showed other count-heavy surfaces:

- Home top count label: `watchlistCount` / `upcomingCount`.
- Library header: `${activeItems.length} matched`.
- Library filter chips: status counts such as `All 116`, `Watching 19`.
- Discover section count: `${activeState.items.length} titles`.
- Profile/list headers use direct lengths and may have the same risk on first heavy-load transitions.

The likely exact problem is inconsistent loading semantics. Some views use `undefined` as loading state, some compute from empty arrays, and some compute from partially settled fallback data.

## Current Code

- `app/(tabs)/home/index.tsx`
  - `watchlistCount`
  - `upcomingCount`
  - `settledWatchlistSnapshot`
- `app/(tabs)/library/index.tsx`
  - `activeItems.length`
  - `statusOptionsWithCounts`
  - `libraryCounts`
- `app/(tabs)/discover/index.tsx`
  - `SectionHeader`
  - `activeState.items.length`
- `components/PageIntro.tsx`
- `components/FilterChipGroup.tsx`

## Recommended Solution

Add a small stable display-value utility layer instead of patching each label ad hoc.

Create a hook:

```ts
function useStableDisplayValue<T>(
  value: T | null | undefined,
  options?: { isLoading?: boolean; shouldHold?: (value: T) => boolean }
): T | null | undefined
```

Behavior:

- If loading/refetching and a previous valid value exists, keep showing the previous value.
- Only show `0` when the resolved data confirms zero.
- Reset stale values when the identity/context changes, such as media tab, route, or query args.
- If the label/value meaning changes, hold the previous label and value together until the new pair is ready.

For counts specifically, create a thin wrapper:

```ts
function useStableCount(
  value: number | null | undefined,
  contextKey: string,
  isLoading: boolean
): number | null | undefined
```

For label/value pairs, use a separate helper or state shape:

```ts
type DisplayPair = {
  label: string;
  value: string;
  contextKey: string;
};
```

## Implementation Steps

1. Add `hooks/use-stable-display-value.ts`.
2. Apply it first to Home:
   - `watchlistCount`
   - `upcomingCount`
   - specifically verify `Watchlist -> Schedule` and `Schedule -> Watchlist` transitions.
   - use existing watchlist settle logic as the context source.
3. Apply it to Library:
   - `activeItems.length`
   - `statusOptionsWithCounts` counts when `libraryCounts` is undefined.
4. Apply it to Discover:
   - active section count.
5. Audit Profile/list/detail headers for same-position count-like values and apply the helper where a loading transition can temporarily report `0`.
6. Optionally update `PageIntro` to accept `rightLabelIsLoading` or a richer `rightSlot` later.

## UX Rules

- A stale count can stay visible during refetch.
- Do not show `0 matched` during a known loading/settling state.
- Do show `0 matched` after loading completes and the filters truly have no results.
- When the same UI slot changes meaning, keep the previous value until the new value is ready, then switch directly to the new value.
- When the same UI slot changes label and value meaning, keep the previous label and previous value until the new pair is ready.
- If a count is stale, avoid adding a heavy spinner beside it. If needed, use subtle opacity or a tiny loading dot.

## Verification

- Trigger Home media filter changes and schedule/watchlist switches.
- Trigger Library tab/status/search changes.
- Trigger Discover tab/filter changes.
- Confirm counts do not flicker to `0` while skeletons or loading rows are visible.
- Confirm real empty states still show zero or empty copy after loading resolves.

## Risks

- Holding stale counts too long can make filters feel incorrect.
- Context keys must be precise; stale `All` counts must not leak into `Anime` or `Movies`.
- Avoid hiding real empty results.
