# ADR-0009: Monetization Entitlements and Network Ad Surfaces

## Context

ShowTracker needs an early monetization path: free users should see real network ads, and paid users should be able to pay about $4.99/month to remove them. The risky area is Home and Schedule, because those screens carry the watchlist, episode availability, and calendar signals that have regressed before.

## Current Behavior

Before this change, the app had no monetization data model, no subscription page, and no durable ad-free entitlement. An intermediate local version showed placeholder ad blocks, but those were not network-filled ads.

Home watchlist rows are rendered from the existing active feed, paused, not-started, today scheduled feed, and future schedule count queries. Schedule calendar views render from the existing upcoming schedule query and local date selection state. Profile had no plan state.

## Decision

Add a single provider-ready `ad_free` entitlement in Convex and read it through `monetization.getViewerAccess`. Add reusable `NetworkAdPlacement` components on Home, Schedule, and Profile. Native iOS/Android placements render AdMob banner ads through `react-native-google-mobile-ads`, using Google test ids by default. Web placements render Google Publisher Tag network ads through Google's sample Ad Manager test unit by default.

Add `/subscribe` as the Plus plan page with RevenueCat paywall support plus a local preview checkout when no live billing path is configured. Add verified Convex HTTP endpoints for RevenueCat and Clerk Billing webhook events. Both endpoints normalize provider events into the same `userEntitlements` table instead of changing Home, Schedule, watchlist, or episode availability data.

The Home and Schedule data paths remain unchanged. Ads are not inserted into watchlist arrays, schedule arrays, provider reconciler output, route IDs, duplicate-prevention logic, count calculations, or sort keys. They render as separate presentation components around existing sections.

## Reasoning

A single entitlement is safer than coupling ad visibility to a payment provider directly. RevenueCat customer info can hide ads immediately after purchase or restore, and RevenueCat, Clerk Billing, Stripe, App Store, Play Store, or manual support grants can all write the same `ad_free` row through verified server-side webhook handling.

The branch uses AdMob sample app ids and test ad unit ids for native builds. This gives a real network-loaded mobile ad surface without risking invalid production ad traffic or requiring approved AdMob inventory during prototype review. Expo Go cannot load the native Google Mobile Ads module, so native ads require a development, release simulator, TestFlight, EAS, or store build.

Web uses Google Publisher Tag instead of AdMob because AdMob is native-only. GPT is loaded from Google's fixed HTTPS script URL, uses a sample test ad unit by default, reserves fixed ad dimensions to avoid layout shift, collapses on no-fill/error, and requests non-personalized/restricted-data-processing ads. The app does not send user ids, watch history, titles, profile data, or custom audience signals to GPT.

The branch also does not switch the app to Clerk Auth. Current Convex functions rely on `@convex-dev/auth` user IDs through `getAuthUserId`; replacing that auth provider requires a separate migration plan for existing user data, profiles, lists, watched episodes, and feed projections. A Clerk dashboard app and webhook endpoint are prepared, but runtime auth remains unchanged in this branch.

## Provider/Data Assumptions

RevenueCat is the preferred production billing provider for a cross-platform Expo app because its React Native SDK supports iOS, Android, and React Native Web with shared entitlements and Web Billing. The app supports platform-specific public SDK keys through `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`, and `EXPO_PUBLIC_REVENUECAT_WEB_API_KEY`, with `EXPO_PUBLIC_REVENUECAT_API_KEY` retained only as a generic fallback for local review.

The app reads `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` and checks `ad_free` plus configured aliases while dashboard naming is being finalized. Native RevenueCat initialization is intentionally blocked when the selected public key starts with `test_`, because RevenueCat test keys are not valid native SDK keys. Web keeps the local preview checkout unless `EXPO_PUBLIC_REVENUECAT_WEB_PAYWALL_ENABLED=true`, because RevenueCat Web Billing/paywall setup is separate from the iOS product.

RevenueCat webhooks are trusted only when their configured authorization header matches Convex env. Clerk Billing webhooks are trusted only with a valid Svix signature from the configured endpoint signing secret, or with the fallback shared authorization header when local fallback is explicitly enabled. Clerk events must provide a Convex `users` id candidate, preferably `convexUserId` metadata, before they can change an entitlement.

Provider customer ids are not written by the webhook handlers; only the Convex user id candidate, entitlement status, provider event id, product/plan id, and period timestamps are needed for the ad-free entitlement.

AdMob is the preferred native ads provider. Until real store listings, app ids, and `app-ads.txt` are ready, the native app must keep `EXPO_PUBLIC_ADMOB_TEST_ADS=true` and use Google sample ids. Web ad inventory uses GPT sample inventory for local review and must move to the production site's own Ad Manager or AdSense units before release.

No TMDB, TVMaze, AniList, Jikan/MAL, IMDb, title fallback, anime season alias, bridge ID, route ID, canonical key, or provider confidence behavior changes in this ADR.

## Edge Cases

Completed shows with new releases, paused shows, dropped shows, planned/not-started shows, long-running shows, anime season aliases, missing providers, title fallbacks, same-day duplicate episodes, future weekly rows, and stale provider totals are intentionally unaffected. The ad components do not participate in feed filtering, schedule counts, episode availability, `remainingEpisodes`, `releasedEpisodes`, `newEpisodeSignalAt`, `homeSortAt`, `watchlistAirtimeMode`, or completed-show reactivation.

If a user has an active Convex or RevenueCat entitlement, network ad placements are hidden. If no provider entitlement exists, local preview mode can hide ads on the current device for review only. Preview mode does not write a Convex entitlement.

Provider webhook events without a matching entitlement id, matching Plus plan id, or matching Convex user id are acknowledged but ignored. Duplicate provider events update the same `(userId, ad_free)` row instead of creating multiple visible ad-free states.

## Verification

Completed on May 17, 2026:

- `npx convex codegen` passed and generated `api.monetization`.
- `npx tsc --noEmit` passed.
- `npx expo lint` passed.
- `git diff --check` passed.
- `npm audit --audit-level=low` reported 0 vulnerabilities.
- `npx expo-doctor` passed 17/17 checks.
- `npx expo export --platform web --output-dir artifacts/monetization/web-export-smoke-post-patch` passed; the generated smoke export directory was removed.
- `npx expo export --platform ios --output-dir artifacts/monetization/ios-export-smoke-post-patch` passed; the generated smoke export directory was removed.
- `npx expo export --platform android --output-dir artifacts/monetization/android-export-smoke-post-patch` passed; the generated smoke export directory was removed.
- `npx expo config --type introspect` confirmed the AdMob config plugin writes `GADApplicationIdentifier=ca-app-pub-3940256099942544~1458002511`, `GADDelayAppMeasurementInit=true`, and Android `com.google.android.gms.ads.APPLICATION_ID=ca-app-pub-3940256099942544~3347511713`.
- `npx expo config --type public` confirmed no secrets are embedded in `extra`.
- Chrome DevTools inspection against `http://localhost:8081/home` confirmed real GPT ad surfaces: page text contained two `ADVERTISEMENT` labels, `googletag.apiReady=true`, two GPT slots for `/6355419/Travel/Europe/France/Paris`, one filled Google ad iframe, and requests to Google ad-serving hosts. Screenshot: `artifacts/monetization/chrome-devtools-home-gpt-ads.png`.
- Browser screenshots after the final web ad fix: `artifacts/monetization/current-home-ads-after-web-fix.png` and `artifacts/monetization/current-home-ads-after-web-fix-full.png`.
- iOS Release simulator proof confirmed a native AdMob test banner after guest navigation. Screenshot: `artifacts/monetization/ios-current-home-ad-after-wait.png`.
- Android Release APK proof confirmed a native AdMob test banner after guest navigation. Screenshot: `artifacts/monetization/android-release-home-after-guest-wait.png`.
- `UI_INSPECT_ROUTES=/home,/profile,/subscribe UI_INSPECT_CONTEXTS=desktop,mobile-window UI_INSPECT_THEMES=dark npm run ui:inspect:quick` passed with 0 issues and no console/request failures; report: `artifacts/ui-inspect/2026-05-17T14-43-07.147Z-report.json`.
- Monetization-specific security scan found no pasted RevenueCat test key, common secret patterns, raw SDK error leaks, SDK debug logging, persisted provider customer info, provider customer id storage, provider customer indexes, or dangerous DOM sinks in the monetization implementation.
- `ios/`, `android/`, and `dist/` were absent after verification so the repo remains Expo-managed.

Known-show checks are not required for the monetization UI itself because no provider matching or episode facts are changed. If a future change moves ads into list data or schedule rows, re-run known-title watchlist/schedule checks in that PR.

## Rollback Notes

If ads disrupt Home or Schedule, remove the `NetworkAdPlacement` calls from `app/(tabs)/home/index.tsx` first. If webhook sync causes entitlement problems, remove or rotate the relevant provider webhook config in RevenueCat or Clerk before changing watchlist or schedule code.

If the subscription surface must be fully reverted, remove `/subscribe`, `components/monetization/*`, `hooks/use-monetization-access.ts`, `lib/monetization/*`, `convex/monetization.ts`, the webhook routes in `convex/http.ts`, and the `userEntitlements` table. Existing watchlist and schedule data should not need migration because this change does not alter those tables.
