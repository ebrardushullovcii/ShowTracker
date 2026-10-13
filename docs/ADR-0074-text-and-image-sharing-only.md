# ADR-0074: Sharing exports use text and images

The downloadable ballot and browseable HTML formats from ADR-0073 are removed. Sharing a file that the recipient must download and open in a browser adds friction to the simple task of choosing a show in a chat.

Sharing offers fourteen formats: four text formats and ten image formats, including the three-pick shortlist and this-or-that comparison. Copying text, public show links, PNG sharing, and numbered image ZIPs remain. The Library, custom-list, and show-menu entry points retain the snapshot and privacy boundaries in ADR-0073.

The app still uses its internal canvas composer for preview and export; HTML is no longer a downloadable sharing format. This changes no synced data, Convex functions, or schedule-confidence/VPS behavior.
