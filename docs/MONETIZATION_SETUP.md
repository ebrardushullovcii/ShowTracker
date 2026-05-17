# Monetization Setup

Last reviewed: May 17, 2026.

## Recommendation

Use the current Convex Auth for this branch, RevenueCat for production subscriptions, AdMob for native ads, and Google Publisher Tag or AdSense for web ads.

Reasoning:

- The app already has Convex Auth deeply wired into user-owned data. A Clerk Auth migration is feasible, but it should be a separate migration PR because most backend domains use `getAuthUserId`.
- RevenueCat is the best production subscription fit for Expo across iOS, Android, and web because it can share one entitlement model across store purchases and Web Billing.
- Clerk Billing is a possible web checkout path, but it should not be treated as the default mobile subscription layer for App Store or Play Store digital features.
- Native AdMob is wired with Google's sample app ids and test banner ids for development/release proof. Real production ad unit ids should wait until AdMob app setup, store listings, and `app-ads.txt` are ready.
- Web ads are wired through Google Publisher Tag with Google's sample Ad Manager test unit by default. Production requires the site's own approved Ad Manager or AdSense inventory.

Relevant docs:

- RevenueCat Expo: https://www.revenuecat.com/docs/getting-started/installation/expo
- RevenueCat entitlements: https://www.revenuecat.com/docs/getting-started/entitlements
- RevenueCat Web Billing: https://www.revenuecat.com/docs/web/web-billing/configuring-overview
- RevenueCat webhooks: https://www.revenuecat.com/docs/integrations/webhooks
- React Native Google Mobile Ads: https://docs.page/invertase/react-native-google-mobile-ads
- Google Publisher Tag basics: https://developers.google.com/publisher-tag/guides/learn-basics
- Google Publisher Tag ad sizes: https://developers.google.com/publisher-tag/guides/ad-sizes
- Google Publisher Tag privacy: https://developers.google.com/publisher-tag/samples/configure-privacy
- AdMob app-ads.txt verification: https://support.google.com/admob/answer/14538460
- Convex + Clerk: https://docs.convex.dev/auth/clerk
- Clerk webhooks: https://clerk.com/docs/guides/development/webhooks/overview

## What This Branch Implements

- `userEntitlements` in Convex with one `ad_free` entitlement.
- `convex/monetization.ts` with `getViewerAccess`, user entitlement upsert, and provider entitlement sync.
- Reusable `NetworkAdPlacement` components on Home, Schedule, and Profile.
- `/subscribe` with a $4.99/month Plus offer.
- RevenueCat SDK integration for customer info refresh, entitlement checks, native paywall presentation, and purchase restore.
- Local preview checkout fallback that hides ads without live payment keys.
- Native AdMob banner rendering on iOS/Android through `react-native-google-mobile-ads`, using Google test ads by default.
- Web Google Publisher Tag rendering through `https://securepubads.g.doubleclick.net/tag/js/gpt.js`, using Google's sample Ad Manager test unit by default.
- Verified Convex HTTP webhook endpoints for RevenueCat and Clerk Billing entitlement sync.
- Environment placeholders in `.env.example`.

## Local Preview

Set these in `.env.local` while reviewing:

```bash
EXPO_PUBLIC_SHOW_ADS=true
EXPO_PUBLIC_MONETIZATION_DEMO_MODE=true
EXPO_PUBLIC_BILLING_PROVIDER=revenuecat
EXPO_PUBLIC_AD_PROVIDER=admob
EXPO_PUBLIC_PREMIUM_PLAN_ID=showtracker_plus_monthly

EXPO_PUBLIC_ADMOB_TEST_ADS=true
EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID=
EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID=
EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID=

EXPO_PUBLIC_GPT_TEST_ADS=true
EXPO_PUBLIC_GPT_AD_UNIT_PATH=
EXPO_PUBLIC_GPT_HOME_TOP_AD_UNIT_PATH=
EXPO_PUBLIC_GPT_HOME_INLINE_AD_UNIT_PATH=
EXPO_PUBLIC_GPT_SCHEDULE_TOP_AD_UNIT_PATH=
EXPO_PUBLIC_GPT_PROFILE_AD_UNIT_PATH=
EXPO_PUBLIC_GPT_BANNER_SIZES=300x250

EXPO_PUBLIC_REVENUECAT_API_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
EXPO_PUBLIC_REVENUECAT_WEB_API_KEY=
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=ad_free
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ALIASES=
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=
EXPO_PUBLIC_REVENUECAT_WEB_PAYWALL_ENABLED=false
EXPO_PUBLIC_SUBSCRIPTION_CHECKOUT_URL=
```

Then:

1. Sign in or continue as guest.
2. Open Home, Schedule, or Profile and confirm network ad placements are visible.
3. Open Profile > Plus, or go directly to `/subscribe`.
4. Use the local preview checkout when no live RevenueCat checkout is available.
5. Return to Home/Profile and confirm network ad placements are hidden.
6. Use `Return to ad-supported preview` on `/subscribe` to show ads again.

## RevenueCat Production Setup

1. Go to https://app.revenuecat.com and create a project named `ShowTracker`.
2. Add apps for iOS, Android, and Web Billing.
3. Create an entitlement with identifier `ad_free`.
4. Create products:
   - `showtracker_plus_monthly` at `$4.99/month` for iOS.
   - `showtracker_plus_monthly` at `$4.99/month` for Android.
   - `showtracker_plus_monthly` at `$4.99/month` for Web Billing.
5. Attach all three products to the `ad_free` entitlement.
6. Create an offering named `default` and add the monthly package.
7. Configure a RevenueCat paywall for the current offering.
8. Put platform-specific public SDK keys in ignored local or deployment environment variables:

```bash
EXPO_PUBLIC_BILLING_PROVIDER=revenuecat
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=your-ios-public-revenuecat-sdk-key
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=your-android-public-revenuecat-sdk-key
EXPO_PUBLIC_REVENUECAT_WEB_API_KEY=your-web-public-revenuecat-sdk-key
EXPO_PUBLIC_REVENUECAT_API_KEY=
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=ad_free
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ALIASES=
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=
EXPO_PUBLIC_REVENUECAT_WEB_PAYWALL_ENABLED=false
```

Use `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` only when you need to force a non-current offering. If the RevenueCat dashboard entitlement is temporarily named `plus`, set `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=plus`; the app also checks `ad_free` as a fallback alias.

The generic `EXPO_PUBLIC_REVENUECAT_API_KEY` remains only as a local fallback. Do not use a `test_` key for native iOS/Android SDK initialization; the app intentionally treats `test_` keys as unavailable on native and falls back to preview checkout behavior. Do not put RevenueCat secret keys in `EXPO_PUBLIC_*` variables.

Native store purchases require a development build, release build, TestFlight, EAS, or store build. Expo Go is not enough for AdMob and should not be used as the final native billing/ad proof. Web purchases require a RevenueCat Web Billing app/product and `EXPO_PUBLIC_REVENUECAT_WEB_PAYWALL_ENABLED=true`; otherwise web keeps the local preview checkout so the prototype can still validate ad removal.

Configure the RevenueCat webhook to call the Convex HTTP endpoint:

```bash
https://grandiose-gerbil-623.convex.site/revenuecat-webhook
```

Set the same authorization header in the RevenueCat dashboard and Convex:

```bash
npx convex env set REVENUECAT_WEBHOOK_AUTHORIZATION "Bearer <random-shared-secret>"
npx convex env set MONETIZATION_ENTITLEMENT_IDS "ad_free,plus"
```

The handler accepts RevenueCat `ad_free` and `plus` entitlement ids, maps the RevenueCat app user id or aliases back to a Convex `users` id, and writes the durable `ad_free` row.

## Webhook Endpoints

The dev Convex deployment has two public HTTP endpoints:

- RevenueCat: `https://grandiose-gerbil-623.convex.site/revenuecat-webhook`
- Clerk Billing: `https://grandiose-gerbil-623.convex.site/clerk-billing-webhook`

Required Convex env values:

```bash
npx convex env set MONETIZATION_ENTITLEMENT_IDS "ad_free,plus"
npx convex env set REVENUECAT_WEBHOOK_AUTHORIZATION "Bearer <random-shared-secret>"
npx convex env set CLERK_BILLING_WEBHOOK_AUTHORIZATION "Bearer <random-shared-secret>"
npx convex env set CLERK_BILLING_WEBHOOK_SIGNING_SECRET "whsec_<clerk-endpoint-secret>"
npx convex env set CLERK_WEBHOOK_SIGNING_SECRET "whsec_<clerk-endpoint-secret>"
npx convex env set CLERK_BILLING_PLUS_PLAN_IDS "showtracker_plus_monthly,plus,ShowTracker Plus"
```

The RevenueCat endpoint verifies the shared authorization header. The Clerk endpoint verifies the Svix signing secret from the Clerk webhook endpoint. The fallback authorization header is disabled by default; enable it only for local smoke tests with:

```bash
npx convex env set CLERK_BILLING_ALLOW_AUTHORIZATION_FALLBACK true
```

The handlers do not persist provider customer ids and successful responses do not expose internal entitlement document ids.

## Native Ads Setup

Current prototype status:

- `react-native-google-mobile-ads` is installed.
- `app.json` includes the package config plugin with Google's sample Android and iOS AdMob app ids.
- `NetworkAdPlacement` renders a real Google Mobile Ads `BannerAd` on iOS/Android when `ad_free` is false.
- Test ads are enabled by default with `EXPO_PUBLIC_ADMOB_TEST_ADS=true`; this uses the package `TestIds.BANNER` value for the current native platform.
- Production can use `EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID` and `EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID`; `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID` remains a shared fallback only.
- Expo Go returns no native ad because the native Google Mobile Ads module is not bundled into Expo Go.
- Native requests use `requestNonPersonalizedAdsOnly: true`.

To see network-filled native ads, run an iOS or Android development/release build. This has been verified with release simulator/APK screenshots:

- `artifacts/monetization/ios-current-home-ad-after-wait.png`
- `artifacts/monetization/android-release-home-after-guest-wait.png`

For production:

1. Go to https://admob.google.com and create an AdMob account.
2. Add the Android and iOS apps once bundle IDs/store listings are known.
3. Create banner ad units for the small placements.
4. Replace the sample app ids in `app.json` with the real AdMob app ids.
5. Set `EXPO_PUBLIC_ADMOB_TEST_ADS=false`.
6. Set `EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID` and `EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID` to the production banner ad unit ids. Use `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID` only as a shared fallback for temporary testing.
7. Publish `app-ads.txt` at the root domain associated with the store listings.
8. Build with EAS or a local development/release build and confirm all test devices are marked as test devices before clicking ads.

## Web Ads Setup

Current prototype status:

- `NetworkAdBanner.web.tsx` loads Google Publisher Tag from `https://securepubads.g.doubleclick.net/tag/js/gpt.js`.
- Test ads are enabled by default with `EXPO_PUBLIC_GPT_TEST_ADS=true`; this uses Google's sample Ad Manager ad unit `/6355419/Travel/Europe/France/Paris`.
- The web ad component reserves a fixed `300x250` slot by default so the page does not shift when the network creative loads.
- Empty/error/no-fill GPT slots collapse to `null`, so users do not see a permanent placeholder block.
- The component does not pass user ids, watch history, titles, or custom profile data to the ad network.
- The component requests non-personalized ads, restricted data processing, and disables personalization treatment through GPT privacy settings.

Verified web proof:

- `artifacts/monetization/chrome-devtools-home-gpt-ads.png`
- `artifacts/monetization/current-home-ads-after-web-fix.png`
- `artifacts/monetization/current-home-ads-after-web-fix-full.png`

For production GPT:

1. Create or use a Google Ad Manager network.
2. Create ad units for the production web domain and desired placements.
3. Set `EXPO_PUBLIC_GPT_TEST_ADS=false`.
4. Set `EXPO_PUBLIC_GPT_AD_UNIT_PATH` for the shared default, or set placement-specific values such as `EXPO_PUBLIC_GPT_HOME_TOP_AD_UNIT_PATH`.
5. Set `EXPO_PUBLIC_GPT_BANNER_SIZES`; the first size controls the reserved slot dimensions. Keep a stable size such as `300x250` unless the UI is intentionally redesigned.
6. Configure production CSP/edge headers to allow the required Google ad domains while keeping other script sources locked down.

For AdSense, use an approved AdSense site and replace the GPT renderer with an AdSense-specific web renderer. Do not put private account credentials in `EXPO_PUBLIC_*` variables.

## Clerk Auth/Billing Option

Use Clerk Auth in the app only after a separate auth migration plan.

Current prototype status:

- Clerk webhook handling exists for `https://grandiose-gerbil-623.convex.site/clerk-billing-webhook`.
- The Convex handler ignores unrelated Clerk events.
- The app runtime still uses Convex Auth because the current backend and user data model depend on `@convex-dev/auth` user ids.

Steps for a future Clerk branch:

1. Create a Clerk application.
2. Add `@clerk/expo` and configure `ClerkProvider` with secure token cache.
3. Configure Convex with Clerk using `ConvexProviderWithClerk`.
4. Decide how to map old Convex Auth `users` IDs to Clerk user IDs.
5. Migrate or bridge all user-owned tables: `userProfiles`, `userShows`, `watchedEpisodes`, `customLists`, `feedProjections`, `userStats`, favorites, settings, and entitlements.
6. Only after the data model is bridged, replace the current login/register routes with Clerk native/web components.

For Clerk Billing:

1. Enable Billing in the Clerk dashboard.
2. Connect Stripe.
3. Create a user plan named `ShowTracker Plus`.
4. Set monthly price to `$4.99`.
5. Add a feature/entitlement equivalent to `ad_free`.
6. Make sure plan identifiers are included in `CLERK_BILLING_PLUS_PLAN_IDS`.
7. Include the Convex `users` id as `convexUserId` metadata when starting checkout, or complete the Clerk Auth migration so Clerk user ids can be bridged to Convex users.
8. Use Clerk checkout or `<PricingTable />` on web.
9. Keep the existing Clerk billing webhook writing `userEntitlements`.

Confirm App Store/Play Store policy before using Stripe-based checkout inside native mobile apps for digital app features.
