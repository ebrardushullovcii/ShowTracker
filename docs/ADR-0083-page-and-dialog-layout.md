# ADR-0083: Shared Page and Dialog Layout

Phone pages use 20-point side margins. Page scroll containers share a 24-point bottom inset so the final item clears the tab bar or viewport edge. On phones, detail overlays start just below the top safe area with a softly rounded surface. Overlay headers share a compact row and a leading Close button with a transparent background and a subtle rounded outline. The detail artwork uses the same side margins as the page content.

Centered dialogs use 16-point outer margins and 16-point horizontal padding. Confirmations cap at 448 points, and editors and pickers cap at 512 points. Dialog headers use the shared leading Close button when a header dismissal is appropriate. Confirmations use an explicit Cancel action. Centered dialogs, detail sheets, and the share composer share a thin rounded outline. Anchored menus use the same low-contrast border color.

Poster grids in Discover, For You, Library, and Search use equal-width cards with 12-point gaps and align their outside edges to the page margins. Compact poster cards use one readable title size and show up to two lines with a trailing ellipsis. They retain the full accessible name, and the detail banner grows to fit the full visible title. Discover's featured card uses a dark fade behind the title, synopsis, and action.

Native sign-in and registration share one centered card. On shorter screens and with the keyboard open, the form can scroll. The native auth card and Sign Out confirmation share a soft top accent. The web auth ticket follows ADR-0071. Profile Controls groups Sign Out under Account near the top, with Help & Privacy and account deletion in their own sections. Confirming Sign Out closes protected screens before revoking the session so their live queries can unsubscribe.

Tailwind defines the page and dialog gutters and dialog width caps. Shared layout rules apply to native and web pages. Native-only presentation, such as keyboard avoidance, stays scoped to the platform that needs it. The page scroll inset and poster grid gaps live in the layout constants. Shared dialog classes live in the global stylesheet.
