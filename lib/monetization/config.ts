export const AD_FREE_ENTITLEMENT_KEY = "ad_free";
export const SHOWTRACKER_PLUS_PLAN_ID =
  process.env.EXPO_PUBLIC_PREMIUM_PLAN_ID ?? "showtracker_plus_monthly";
export const SHOWTRACKER_PLUS_PRICE = "$4.99";

const isDevelopment =
  typeof __DEV__ === "boolean" ? __DEV__ : process.env.NODE_ENV !== "production";

function splitCsv(value: string | undefined) {
  return value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

const revenueCatEntitlementId =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? AD_FREE_ENTITLEMENT_KEY;

export const monetizationConfig = {
  adsEnabled: process.env.EXPO_PUBLIC_SHOW_ADS !== "false",
  demoCheckoutEnabled:
    process.env.EXPO_PUBLIC_MONETIZATION_DEMO_MODE === "true" ||
    (isDevelopment && process.env.EXPO_PUBLIC_MONETIZATION_DEMO_MODE !== "false"),
  checkoutUrl: process.env.EXPO_PUBLIC_SUBSCRIPTION_CHECKOUT_URL,
  billingProvider: process.env.EXPO_PUBLIC_BILLING_PROVIDER ?? "demo",
  adProvider: process.env.EXPO_PUBLIC_AD_PROVIDER ?? "demo",
  revenueCatApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY,
  revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  revenueCatAndroidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  revenueCatWebApiKey: process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY,
  revenueCatEntitlementId,
  revenueCatEntitlementIds: uniqueValues([
    revenueCatEntitlementId,
    AD_FREE_ENTITLEMENT_KEY,
    "plus",
    ...splitCsv(process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ALIASES),
  ]),
  revenueCatOfferingId: process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID,
  revenueCatWebPaywallEnabled:
    process.env.EXPO_PUBLIC_REVENUECAT_WEB_PAYWALL_ENABLED === "true",
};

export const plusBenefits = [
  "No network ads across Home, Schedule, and Profile",
  "Use the same Plus entitlement across web, iOS, and Android",
  "Support the open-source app without changing the core tracker",
];
