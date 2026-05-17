# Monetization Security Audit

Last reviewed: May 17, 2026.

## Executive Summary

The monetization implementation does not commit the pasted RevenueCat test key, does not store ad-network user profiles, does not store provider customer ids, and does not pass watch history, titles, profile data, or Convex user ids to Google ad services.

Web ads use Google Publisher Tag with non-personalized ads and restricted data processing. Native ads use AdMob test units until production app ids/ad units are available. iOS and Android native AdMob rendering were both visually verified in release builds.

No critical, high, or unresolved medium-severity monetization findings remain from this pass.

## Scope

Reviewed files and flows:

- `components/monetization/*`
- `hooks/use-monetization-access.ts`
- `lib/monetization/*`
- `convex/monetization.ts`
- `convex/http.ts`
- `app/subscribe.tsx`
- `app/(auth)/login.tsx`
- `app.json`, `package.json`, `package-lock.json`, `.env.example`

## Findings

### Critical

None found.

### High

None found.

### Medium

None found.

### Resolved During This Pass

1. **Auth redirect hardening**
   - Location: `app/(auth)/login.tsx`
   - Evidence: redirects are normalized by `getSafeRedirectTarget`, which returns `/home` for cross-origin or scheme-based redirects before assigning `window.location.href`.
   - Impact avoided: a malicious or malformed auth redirect cannot push the web app to an external URL through this client code path.

2. **Webhook fallback hardening**
   - Location: `convex/http.ts`
   - Evidence: Clerk Billing authorization-header fallback now requires `CLERK_BILLING_ALLOW_AUTHORIZATION_FALLBACK=true`; otherwise the endpoint relies on Svix signatures.
   - Impact avoided: production Clerk webhook handling no longer silently accepts a shared header fallback unless explicitly enabled for supervised local tests.

3. **Webhook response minimization**
   - Location: `convex/http.ts`
   - Evidence: successful webhook responses return `{ ok: true }` and do not expose internal entitlement document ids.
   - Impact avoided: provider callbacks do not receive unnecessary internal identifiers.

4. **RevenueCat client hardening**
   - Location: `lib/monetization/revenue-cat.ts`, `hooks/use-monetization-access.ts`, `app/subscribe.tsx`
   - Evidence: native SDK initialization is blocked for `test_` keys, automatic SDK debug logging is not enabled, raw `CustomerInfo` is not stored in React state, and user-facing errors use generic messages.
   - Impact avoided: test keys do not create native SDK failures, and raw provider payloads/errors are not retained or shown unnecessarily.

5. **Dependency audit**
   - Location: `package.json`, `package-lock.json`
   - Evidence: Expo patch packages were updated and `postcss` is overridden to a patched 8.5.x release.
   - Verification: `npm audit --audit-level=low` reports 0 vulnerabilities.

### Low / Informational

1. **Web token storage remains existing auth architecture**
   - Location: `lib/auth/token-storage.ts`
   - Evidence: web auth tokens use `localStorage` with an in-memory fallback; native uses `SecureStore`, with a native process-memory fallback for unsigned local simulator cases where SecureStore is unavailable.
   - Notes: this is the existing Convex Auth architecture, not monetization-specific sensitive storage. An HTTP-only cookie session architecture would reduce web token exposure if the app later moves to a server-owned auth layer.

2. **Production ad units are intentionally not configured**
   - Evidence: native uses Google AdMob sample app ids and test ad units by default; web uses the GPT sample Ad Manager unit by default.
   - Notes: production release still needs approved AdMob apps/ad units, web ad inventory, and `app-ads.txt`. Keeping test units avoids invalid production ad traffic during local review.

## Sensitive Data Review

- The pasted RevenueCat test key is not present in tracked files.
- `.env`, `.env.local`, and `artifacts/private/accounts.md` are ignored.
- `.env.example` contains placeholders only.
- Web GPT ad requests do not include custom targeting, user ids, watched titles, watch history, profile fields, or Convex ids.
- Native AdMob requests use `requestNonPersonalizedAdsOnly: true`.
- Webhook entitlement writes do not persist provider customer ids; they keep only the entitlement state needed for ad removal.
- Successful webhook responses do not expose internal entitlement document ids.

## Verification

- `npx convex codegen` passed.
- `npx tsc --noEmit` passed.
- `npx expo lint` passed.
- `git diff --check` passed.
- `npm audit --audit-level=low` returned 0 vulnerabilities.
- `npx expo-doctor` passed 17/17 checks.
- `npx expo export --platform web --output-dir artifacts/monetization/web-export-smoke-post-patch` passed; the generated directory was removed.
- `npx expo export --platform ios --output-dir artifacts/monetization/ios-export-smoke-post-patch` passed; the generated directory was removed.
- `npx expo export --platform android --output-dir artifacts/monetization/android-export-smoke-post-patch` passed; the generated directory was removed.
- `npx expo config --type public` confirmed no secrets are embedded in `extra`.
- `npx expo config --type introspect` confirmed AdMob iOS/Android app id metadata and delayed app measurement config.
- `UI_INSPECT_ROUTES=/home,/profile,/subscribe UI_INSPECT_CONTEXTS=desktop,mobile-window UI_INSPECT_THEMES=dark npm run ui:inspect:quick` passed with 0 issues and no console/request failures.
- Browser smoke against `http://localhost:8081/home` completed guest login and confirmed GPT readiness, ShowTracker GPT slots, Google ad iframe rendering, Google ad-serving network requests, and visible advertisement labels.
- Chrome DevTools screenshot: `artifacts/monetization/chrome-devtools-home-gpt-ads.png`.
- iOS release simulator screenshot with native AdMob test banner: `artifacts/monetization/ios-current-home-ad-after-wait.png`.
- Android release APK screenshot with native AdMob test banner: `artifacts/monetization/android-release-home-after-guest-wait.png`.
- Focused monetization security scan found no pasted key, common secret patterns, raw SDK error leaks, SDK debug logging, persisted provider customer info, provider customer id storage, provider customer indexes, or dangerous DOM sinks in monetization code.
