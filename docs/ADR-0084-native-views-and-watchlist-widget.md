# ADR-0084: Native views and Watchlist widget

iPhone uses the system bottom bar for Home, Discover, For You, Library, and Profile. Search opens from Discover as its own screen so it fits the iPhone's five visible tabs. Android and web use the existing tab layout. Long-pressing a poster on iPhone opens a compact menu using the shared dialog panel. Tapping outside dismisses it. Native poster menus open the same tracking and sharing screens as the standard show actions. Native success haptics follow confirmed tracking changes.

The iOS Home Screen widget prefers the earliest available unwatched episode of the most recently watched eligible show. The app starts with Home's resolved, unfiltered Watchlist feeds, checks the provider's episode coordinates against saved watched keys, and applies the user's Episode Availability preference. A same-day release gets a New today label until local midnight. When the resolved Home feeds show no available backlog, the widget uses the existing Schedule feed and future-count results to show a pending release in the next four weeks.

The app and widget share a display snapshot in a protected App Group file. The small widget shows the first recommendation over a full-bleed poster with a dark gradient behind the text. Medium and large widgets show up to two and four recommendations respectively, with a show poster and a link for each row. The app downloads and downsamples only the posters in the snapshot. The extension reads the cached artwork and falls back to its regular background or row placeholder when a poster is unavailable.

Medium and large widgets can mark a Continue Watching episode as watched through an App Intent. The signed grant in the protected snapshot is limited to the exact prepared episodes and the originating auth session. Convex rechecks the active session and account and requires the show to still belong to the Watchlist. The save uses the existing episode history and tracking aggregate paths. Repeated taps on the same episode do not add rewatches. After confirmation, the widget advances to the first prepared episode Convex confirms is still unwatched. It removes the row when the prepared list is exhausted and recomputes the list when the Watchlist next opens. The regular app's sign-in tokens stay in SecureStore.

The app refreshes the snapshot while the unfiltered Watchlist is open and clears it and the cached thumbnails on sign-out or loss of account access. Continue Watching expires after seven days without a refresh and an upcoming release expires after its local air day.

The widget episode control uses an outlined circle for an unwatched episode and shows a green check while the intent runs. The refreshed row shows the next episode with an empty circle or the current episode with an error if the save fails.

`npx expo prebuild --clean --platform ios` generates the WidgetKit extension from `targets/watchlist-widget`. Signed distribution requires activating the App Group on both Apple identifiers and refreshing their provisioning profiles.

The current Expo-generated app delegate uses UIKit's legacy lifecycle. The TestFlight EAS profile builds with Xcode 26. A build linked against the iOS 27 SDK must adopt the UIKit scene lifecycle before it can launch.
