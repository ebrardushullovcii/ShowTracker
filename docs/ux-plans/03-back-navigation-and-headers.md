# Plan: Back Navigation and Detail Headers

## Problem

The app hides native Expo Router headers globally, so detail/create pages rely on browser/system back or gestures. On mobile-width web, list creation and show detail pages have no obvious back button.

Browser inspection confirmed:

- `/show/tmdb%3Atv%3A615`: rich hero header but no visible back affordance.
- `/list/create`: page starts with `Create List`, no visible way back.
- List detail likely has the same issue in view mode.

This is especially noticeable because headers often have unused top-left/top-right space.

## Current Code

- `app/_layout.tsx`
  - `Stack` has `headerShown: false`.
- `components/PageIntro.tsx`
- `components/ShowHeader.tsx`
- `app/show/[id].tsx`
- `app/list/[id].tsx`
- `app/list/create.tsx`
- `app/import.tsx`

## Recommended Solution

Add app-level custom back affordances rather than enabling native headers globally. Scope this to authenticated non-tab shell pages.

Create:

- `components/HeaderIconButton.tsx`
- `components/AppBackButton.tsx`

Behavior:

- Use `router.canGoBack()` and `router.back()` when possible.
- Fall back to a route passed by the screen, such as `/home`, `/library`, or `/profile`.
- Use contextual fallbacks:
  - Show detail -> `/home`
  - List detail -> `/profile`
  - Create list -> `/profile`
  - Import -> `/profile`
  - Unknown authenticated shell pages -> `/home`
- Use icon-only button with accessible label `Go back`.
- On web, support pointer hover/focus.

Visual placement:

- `ShowHeader`: floating top-left back button over the hero image.
- `PageIntro`: optional `leftSlot` or `showBackButton` prop.
- Form pages like `/list/create`: back button in the `PageIntro` left area.
- List detail: back button in `PageIntro`; keep edit/delete actions on the right.

## Candidate Pages

Implement on all authenticated non-tab shell pages:

- `/show/[id]`
- `/list/create`
- `/list/[id]`
- `/import`

Do not add back buttons to:

- Tab roots such as `/home`, `/discover`, `/library`, `/profile`.
- Auth and public landing pages.

Evaluate later:

- Any modal-like shell pages added later.
- Search/result detail pages if they become nested routes.

## Implementation Steps

1. Add reusable `AppBackButton`.
2. Extend `PageIntro` to accept `leftSlot` and `rightSlot`, while preserving `rightLabel` for existing screens.
3. Add a floating `AppBackButton` prop to `ShowHeader`.
4. Wire show detail with fallback `/home`.
5. Wire list create with fallback `/profile`.
6. Wire list detail with fallback `/profile`.
7. Wire import with fallback `/profile`.

## Verification

- Direct-open `/show/tmdb%3Atv%3A615`: button should take the user to fallback, not no-op.
- Navigate Home -> show -> back: button should return to Home.
- Navigate Profile -> list -> back: button should return to Profile/list origin when history exists.
- Keyboard focus should reach the back button before main page actions.

## Risks

- `router.canGoBack()` can behave differently on web after reloads; use route fallback defensively.
- A floating hero button must remain readable over bright/dark poster art.
- Back buttons should not crowd page-specific destructive actions.
