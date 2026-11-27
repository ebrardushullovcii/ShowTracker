# ADR 0001: Overlay Detail Routes for Show Details

## Status

Accepted

## Context

Discovery, For You, Library, Search, Home, Profile, and List Detail all route into the same show detail screen. These source pages are scrollable and often expensive to reconstruct because they contain filters, loaded result pages, rails, or personalized queries.

Users need to open a title, add or inspect it, and return to the exact position they came from. At the same time, `/show/[id]` must remain a shareable URL that works when opened directly.

## Decision

Use an **Overlay Detail Route** for `/show/[id]` when the route is opened from inside an existing shell stack. The root stack presents the route as a transparent modal, and the show screen renders inside the shared drawer (`SheetRouteFrame`) only when the route is dismissible. On phones the drawer covers about 82% of the screen so the source page stays visible above it; it closes by dragging down from the grabber, by pulling down once its content is scrolled to the top, by tapping the dimmed page, or with the close button in the grabber row. Desktop web keeps a docked side panel. Native iOS form sheets with partial-height detents were tried and rejected: in react-native-screens 4.16 they block scrolling inside the sheet, and the full-height page sheet hides the source page.

The same drawer is used for in-screen panels with content (share, add to list, edit tracking, filters, profile editing). Short confirmations stay centered dialogs.

Direct/shared visits to `/show/[id]` render the same show detail screen as a normal full page because there is no meaningful source page behind the route.

## Consequences

- Source Shell Pages remain mounted underneath in-app show detail navigation, preserving scroll position, filters, loaded pages, and local UI state.
- URLs stay canonical and shareable because the detail route remains `/show/[id]`.
- The show detail screen must distinguish dismissible in-app overlays from direct page loads and choose close vs back affordances accordingly.
- Future detail routes should only use this pattern when returning to a preserved source page is more important than replacing the current page.

## Alternatives Considered

- Full-page push for show details: simplest, but loses or risks rebuilding source page scroll state when returning.
- Query-param overlays on source pages: preserves state, but weakens canonical shared URLs and duplicates detail-route logic across sources.
- Always render `/show/[id]` over a default Shell Page: keeps overlay visuals, but makes shared links surprising and may show unrelated content behind the detail.
