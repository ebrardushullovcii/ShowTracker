# ADR-0075: Choose together uses playable sharing links

[ADR-0076](ADR-0076-link-only-game-creator.md) subsequently restricts creation to a link-only This or that game and removes the shortlist option from the creator.

Choosing together needs a link a friend can open and play, rather than only a comparison image. Retain the Text, Images, and Choose together categories. This or that creates a public, full-screen knockout game: each pair produces a winner, odd entrants advance automatically, and rounds continue until one show wins. Undo and replay are local to the recipient's session. The three-pick format creates a short favorites page with a final result. Both results can be copied or shared back in a chat.

Creating a link is an explicit authenticated action. Convex stores an immutable snapshot of the included public catalogue fields and the user's heading, message, and optional sender name. Random 160-bit tokens grant read access without signing in. Public reads return no owner IDs, tracking state, watch history, or companion names. Link creation is bounded by snapshot size and daily owner usage; provider and app links are reconstructed from qualified IDs. Covers stay on external CDNs. No image files are stored in Convex.

Links expire after thirty days and can be revoked by their creator in the export preview. Scheduled deletion and read-time expiry checks prevent expired access. Editing a selection or message creates a different snapshot; it does not change an already shared link. Recipient choices are temporary and never modify a Library, custom list, or shared vote tally. An existing link remains playable if the source collection changes.

Web and native open the same public `/share/[token]` route without the authenticated app shell. Existing text and image exports remain available. The schedule-confidence reconciler and VPS have no responsibilities in this flow. This revises ADR-0073's restriction on hosted sharing and preserves the absence of downloadable recipient HTML from ADR-0074.
