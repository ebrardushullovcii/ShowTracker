import type {
  CustomerInfo,
  CustomerInfoUpdateListener,
  PurchasesOffering,
} from "react-native-purchases";
import { Platform } from "react-native";
import { monetizationConfig } from "@/lib/monetization/config";

type PurchasesModule = typeof import("react-native-purchases").default;
type RevenueCatUiModule = typeof import("react-native-purchases-ui").default;

export type RevenueCatAccessSnapshot = {
  isAdFree: boolean;
  activeEntitlementId?: string;
  productIdentifier?: string;
  currentPeriodEnd?: number;
};

export type RevenueCatPaywallResult = RevenueCatAccessSnapshot & {
  result: string;
};

let purchasesPromise: Promise<PurchasesModule> | null = null;
let revenueCatUiPromise: Promise<RevenueCatUiModule> | null = null;
let initialConfigurePromise: Promise<PurchasesModule> | null = null;
let configuredAppUserId: string | undefined;

function getPurchasesModule() {
  purchasesPromise ??= import("react-native-purchases").then(
    (purchasesModule) => purchasesModule.default
  );

  return purchasesPromise;
}

function getRevenueCatUiModule() {
  revenueCatUiPromise ??= import("react-native-purchases-ui").then(
    (revenueCatUiModule) => revenueCatUiModule.default
  );

  return revenueCatUiPromise;
}

function getApiKey() {
  const fallbackApiKey = monetizationConfig.revenueCatApiKey?.trim();

  if (Platform.OS === "ios") {
    return monetizationConfig.revenueCatIosApiKey?.trim() || fallbackApiKey;
  }

  if (Platform.OS === "android") {
    return monetizationConfig.revenueCatAndroidApiKey?.trim() || fallbackApiKey;
  }

  if (Platform.OS === "web") {
    return monetizationConfig.revenueCatWebApiKey?.trim() || fallbackApiKey;
  }

  return fallbackApiKey;
}

function isNativeTestApiKey() {
  const apiKey = getApiKey();
  return Platform.OS !== "web" && Boolean(apiKey?.startsWith("test_"));
}

function normalizeAppUserId(appUserId?: string | null) {
  return appUserId?.trim() || undefined;
}

function getActiveEntitlement(customerInfo: CustomerInfo) {
  const activeEntitlements = customerInfo.entitlements.active;

  for (const entitlementId of monetizationConfig.revenueCatEntitlementIds) {
    const entitlement = activeEntitlements[entitlementId];
    if (entitlement?.isActive) {
      return entitlement;
    }
  }

  return undefined;
}

async function getOffering(Purchases: PurchasesModule) {
  const offeringId = monetizationConfig.revenueCatOfferingId?.trim();
  if (!offeringId) {
    return undefined;
  }

  const offerings = await Purchases.getOfferings();
  return offerings.all[offeringId] as PurchasesOffering | undefined;
}

export function isRevenueCatConfigured() {
  return Boolean(getApiKey()) && !isNativeTestApiKey();
}

export function getRevenueCatUnavailableReason() {
  if (isNativeTestApiKey()) {
    return "RevenueCat native SDK requires an iOS or Android public SDK key.";
  }

  if (isRevenueCatConfigured()) {
    return null;
  }

  return "RevenueCat API key is not configured.";
}

export function getRevenueCatAccessSnapshot(
  customerInfo?: CustomerInfo | null
): RevenueCatAccessSnapshot {
  if (!customerInfo) {
    return { isAdFree: false };
  }

  const entitlement = getActiveEntitlement(customerInfo);
  return {
    isAdFree: Boolean(entitlement),
    activeEntitlementId: entitlement?.identifier,
    productIdentifier: entitlement?.productIdentifier,
    currentPeriodEnd: entitlement?.expirationDateMillis ?? undefined,
  };
}

export async function configureRevenueCat(appUserId?: string | null) {
  const apiKey = getApiKey();
  if (!apiKey || isNativeTestApiKey()) {
    return null;
  }

  const normalizedAppUserId = normalizeAppUserId(appUserId);
  const Purchases = await getPurchasesModule();

  if (!initialConfigurePromise) {
    initialConfigurePromise = Purchases.isConfigured()
      .catch(() => false)
      .then((isConfigured) => {
        if (!isConfigured) {
          Purchases.configure({
            apiKey,
            appUserID: normalizedAppUserId,
          });
          configuredAppUserId = normalizedAppUserId;
        }
        return Purchases;
      });
  }

  await initialConfigurePromise;

  if (normalizedAppUserId && configuredAppUserId !== normalizedAppUserId) {
    const currentAppUserId = await Purchases.getAppUserID().catch(() => null);
    if (currentAppUserId !== normalizedAppUserId) {
      await Purchases.logIn(normalizedAppUserId);
    }
    configuredAppUserId = normalizedAppUserId;
  }

  return Purchases;
}

export async function getRevenueCatCustomerInfo(appUserId?: string | null) {
  const Purchases = await configureRevenueCat(appUserId);
  if (!Purchases) {
    return null;
  }

  return Purchases.getCustomerInfo();
}

export async function addRevenueCatCustomerInfoListener(
  appUserId: string | null | undefined,
  listener: CustomerInfoUpdateListener
) {
  const Purchases = await configureRevenueCat(appUserId);
  if (!Purchases) {
    return () => undefined;
  }

  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export async function presentRevenueCatPaywall(appUserId?: string | null) {
  const Purchases = await configureRevenueCat(appUserId);
  if (!Purchases) {
    throw new Error(getRevenueCatUnavailableReason() ?? "RevenueCat is not configured.");
  }

  const RevenueCatUI = await getRevenueCatUiModule();
  const customerInfo = await Purchases.getCustomerInfo();
  const existingAccess = getRevenueCatAccessSnapshot(customerInfo);
  if (existingAccess.isAdFree) {
    return { ...existingAccess, result: "already_active" };
  }

  const offering = await getOffering(Purchases);
  const result = await RevenueCatUI.presentPaywall({
    offering,
    displayCloseButton: true,
  });
  const updatedCustomerInfo = await Purchases.getCustomerInfo();

  return {
    ...getRevenueCatAccessSnapshot(updatedCustomerInfo),
    result,
  };
}

export async function restoreRevenueCatPurchases(appUserId?: string | null) {
  if (Platform.OS === "web") {
    throw new Error("Purchase restore is available in the native app.");
  }

  const Purchases = await configureRevenueCat(appUserId);
  if (!Purchases) {
    throw new Error(getRevenueCatUnavailableReason() ?? "RevenueCat is not configured.");
  }

  const customerInfo = await Purchases.restorePurchases();
  return getRevenueCatAccessSnapshot(customerInfo);
}
