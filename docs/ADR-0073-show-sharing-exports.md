# ADR-0073: Share public show snapshots from one export preview

The downloadable recipient HTML formats below were removed by [ADR-0074](ADR-0074-text-and-image-sharing-only.md). The snapshot, privacy, rendering, and entry-point decisions still apply to text and image exports.

Hosted playable links were added by [ADR-0075](ADR-0075-playable-sharing-links.md) and simplified to a link-only This or that creator by [ADR-0076](ADR-0076-link-only-game-creator.md), revising the no-hosted-sharing restriction below.

Library's header shares all records matching its current filters, including cards not yet rendered. Custom-list detail shares the saved list order. The existing show action menu shares one title. Each opens the same export preview, with text, images, and options for choosing together.

Exports accept an explicit list of public catalogue fields. Progress, watch history, people metadata, and internal tracking records never enter the document. Planned scope comes from the active Library status filter, independently of the editable heading. Selection and message edits belong to this temporary export and do not change synced Library or list data.

One HTML canvas renderer draws both the preview and exported PNG. Web hosts the composer in an app-owned iframe; native hosts the same bundled document in a WebView and passes copy/file actions to Expo clipboard, filesystem, and sharing APIs. This keeps the sixteen layouts consistent without duplicating drawing code. App screen images continue to use React Native Image. Covers load from external image CDNs with CORS, bounded concurrency, and a timeout; unavailable covers retain title placeholders. Numbered images and an optional ZIP preserve every included title in a large collection.

The ballot and browseable options are self-contained HTML files with embedded covers, search, genre filters, and locally held picks that the recipient copies into a reply. They create no hosted public list, synced votes, or additional Convex state. Linked text uses public provider catalogue URLs; the single-show link action uses the provider-qualified direct detail routes from ADR-0001. Existing authenticated Library and list reads supply public year, genre, and runtime fields; sharing adds no queries or repair work on navigation.

The schedule-confidence reconciler and VPS have no export responsibilities. A change to hosted sharing or synced collaboration would require a separate decision.
