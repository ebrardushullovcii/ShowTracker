# Plan: Mobile Episode Swipe Actions

## Problem

Episode tracking currently uses tap/check controls. The user wants a faster mobile interaction: swipe an episode to change watch status.

Browser inspection confirmed episode cards are already tappable, but cards are visually dense and tapping the small status control is not the only expected mobile pattern.

## Current Code

- `components/EpisodeCard.tsx`
- `components/SeasonAccordion.tsx`
- `components/ContinueTrackingRail.tsx`
- `app/show/[id].tsx`
  - `handleToggleEpisodeWatched`
  - watched action menu
  - missing previous episodes prompt
  - pending episode state

The project already includes:

- `react-native-gesture-handler`
- `react-native-reanimated`

No current `GestureHandlerRootView` or swipeable usage was found in `app/` or `components/`.

## Recommended Solution

Add swipe actions only to vertical episode list cards first. Do not apply to the horizontal Continue Tracking rail initially because that rail already uses horizontal scrolling.

Use `react-native-gesture-handler/ReanimatedSwipeable`.

Swipe behavior:

- Support left and right swipe actions on mobile.
- Swipe right-to-left exposes `Watch` or `Rewatch`.
- Swipe left-to-right exposes `Unwatch`.
- Swipe reveals an action first; full-swipe auto-execution is disabled in the first implementation.
- Tapping the revealed action calls the existing episode handlers.
- Disable swipe for unreleased episodes unless already watched.

Why reveal-first:

- It avoids accidental status changes while scrolling.
- It can keep existing prompts intact, including missing previous episodes and rewatch/unwatch flows, while still making common actions faster.
- It is easier to make accessible because the action remains a button.

Direction rationale:

- There is no universal platform standard that one direction always means completion.
- Material list guidance allows either direction as long as list behavior is consistent.
- Apple and Gmail-style patterns commonly support edge-specific actions; Gmail also allows user customization.
- ShowTracker will use the user's preferred mapping: right-to-left for `Watch` / `Rewatch`, left-to-right for `Unwatch`.

## Required Foundation

Before adding swipeable rows, confirm app root setup:

- Wrap the root app view in `GestureHandlerRootView` if required.
- Verify this does not disrupt Expo Router web/native layout.
- Keep NativeWind styling inside ordinary `View` wrappers where needed.

## Implementation Steps

1. Add gesture root support in `app/_layout.tsx` if needed.
2. Create `components/SwipeableEpisodeCard.tsx` or add an opt-in `enableSwipeActions` prop to `EpisodeCard`.
3. Use `ReanimatedSwipeable` around `EpisodeCard`.
4. Render a trailing action panel with:
   - icon
   - short label
   - success/warning color depending on action
5. Wire only from `SeasonAccordion` for vertical episode lists.
6. Keep `ContinueTrackingRail` unchanged.
7. Add platform gating:
   - enabled on iOS/Android.
   - disabled on web by default unless manual testing shows trackpad behavior feels good.

## Gesture Conflict Rules

- Do not add horizontal swipe to episode cards inside horizontal rails.
- Avoid swipe-to-change and swipe-between-tabs on the same surface at the same time.
- If Home section swipe is implemented, it should not apply inside episode lists.

## Verification

- Native/mobile:
  - Swipe released unwatched episode, tap action, confirm watched state changes.
  - Swipe watched episode in each direction, confirm unwatch and rewatch/watch-history flows still work as intended.
  - Scroll vertically through episodes without accidental swipe opens.
  - Verify disabled future episodes do not expose invalid actions.
- Web:
  - Confirm swipe is disabled or non-disruptive.
- Regression:
  - `npx expo lint`
  - `npm run ui:inspect:quick` for web visual pass.

## Risks

- Swipeable rows can conflict with vertical scroll if thresholds are too aggressive.
- Web/trackpad behavior may feel accidental.
- ReanimatedSwipeable action press handling should be tested on iOS/Android before shipping.
- Full-swipe execution may be worth adding later for simple watch actions, but should not ship until gesture safety is proven.
