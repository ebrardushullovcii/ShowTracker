import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { monetizationConfig } from "@/lib/monetization/config";
import {
  addRevenueCatCustomerInfoListener,
  getRevenueCatAccessSnapshot,
  getRevenueCatCustomerInfo,
  isRevenueCatConfigured,
  presentRevenueCatPaywall,
  restoreRevenueCatPurchases,
  type RevenueCatAccessSnapshot,
  type RevenueCatPaywallResult,
} from "@/lib/monetization/revenue-cat";

const previewAccessKey = "showtracker.plus.preview.enabled";
const previewAccessListeners = new Set<(enabled: boolean) => void>();

type RevenueCatState = RevenueCatAccessSnapshot & {
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
};

const initialRevenueCatState: RevenueCatState = {
  isConfigured: isRevenueCatConfigured(),
  isLoading: false,
  isAdFree: false,
  error: null,
};

function notifyPreviewAccess(enabled: boolean) {
  for (const listener of previewAccessListeners) {
    listener(enabled);
  }
}

async function readPreviewAccess() {
  if (Platform.OS === "web") {
    try {
      return window.localStorage.getItem(previewAccessKey) === "true";
    } catch {
      return false;
    }
  }

  try {
    return (await SecureStore.getItemAsync(previewAccessKey)) === "true";
  } catch {
    return false;
  }
}

async function writePreviewAccess(enabled: boolean) {
  if (Platform.OS === "web") {
    try {
      if (enabled) {
        window.localStorage.setItem(previewAccessKey, "true");
      } else {
        window.localStorage.removeItem(previewAccessKey);
      }
    } finally {
      notifyPreviewAccess(enabled);
    }
    return;
  }

  try {
    if (enabled) {
      await SecureStore.setItemAsync(previewAccessKey, "true");
    } else {
      await SecureStore.deleteItemAsync(previewAccessKey);
    }
  } finally {
    notifyPreviewAccess(enabled);
  }
}

export function useMonetizationAccess() {
  const serverAccess = useQuery(api.monetization.getViewerAccess);
  const revenueCatAppUserId = serverAccess?.revenueCatAppUserId;
  const isServerAccessLoaded = serverAccess !== undefined;
  const [previewAccess, setPreviewAccess] = useState(false);
  const [isPreviewLoaded, setIsPreviewLoaded] = useState(false);
  const [revenueCatAccess, setRevenueCatAccess] =
    useState<RevenueCatState>(initialRevenueCatState);

  useEffect(() => {
    let isMounted = true;

    void readPreviewAccess().then((enabled) => {
      if (!isMounted) {
        return;
      }
      setPreviewAccess(enabled);
      setIsPreviewLoaded(true);
    });

    const listener = (enabled: boolean) => {
      setPreviewAccess(enabled);
      setIsPreviewLoaded(true);
    };
    previewAccessListeners.add(listener);

    return () => {
      isMounted = false;
      previewAccessListeners.delete(listener);
    };
  }, []);

  const startPreviewSubscription = useCallback(async () => {
    await writePreviewAccess(true);
  }, []);

  const clearPreviewSubscription = useCallback(async () => {
    await writePreviewAccess(false);
  }, []);

  const refreshRevenueCatAccess = useCallback(async () => {
    if (!isRevenueCatConfigured()) {
      setRevenueCatAccess((current) => ({
        ...current,
        isConfigured: false,
        isLoading: false,
        isAdFree: false,
        error: null,
      }));
      return null;
    }

    setRevenueCatAccess((current) => ({
      ...current,
      isConfigured: true,
      isLoading: true,
      error: null,
    }));

    try {
      const customerInfo = await getRevenueCatCustomerInfo(revenueCatAppUserId);
      const snapshot = getRevenueCatAccessSnapshot(customerInfo);
      setRevenueCatAccess({
        ...snapshot,
        isConfigured: true,
        isLoading: false,
        error: null,
      });
      return snapshot;
    } catch (error) {
      setRevenueCatAccess((current) => ({
        ...current,
        isConfigured: true,
        isLoading: false,
        isAdFree: false,
        error: "Unable to load RevenueCat entitlement.",
      }));
      return null;
    }
  }, [revenueCatAppUserId]);

  useEffect(() => {
    if (!isServerAccessLoaded || !isRevenueCatConfigured()) {
      return;
    }

    let isMounted = true;
    let removeListener: (() => void) | undefined;

    setRevenueCatAccess((current) => ({
      ...current,
      isConfigured: true,
      isLoading: true,
      error: null,
    }));

    void getRevenueCatCustomerInfo(revenueCatAppUserId)
      .then((customerInfo) => {
        if (!isMounted) {
          return;
        }
        setRevenueCatAccess({
          ...getRevenueCatAccessSnapshot(customerInfo),
          isConfigured: true,
          isLoading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setRevenueCatAccess((current) => ({
          ...current,
          isConfigured: true,
          isLoading: false,
          isAdFree: false,
          error: "Unable to load RevenueCat entitlement.",
        }));
      });

    void addRevenueCatCustomerInfoListener(revenueCatAppUserId, (customerInfo) => {
      if (!isMounted) {
        return;
      }
      setRevenueCatAccess({
        ...getRevenueCatAccessSnapshot(customerInfo),
        isConfigured: true,
        isLoading: false,
        error: null,
      });
    }).then((cleanup) => {
      if (isMounted) {
        removeListener = cleanup;
      } else {
        cleanup();
      }
    });

    return () => {
      isMounted = false;
      removeListener?.();
    };
  }, [isServerAccessLoaded, revenueCatAppUserId]);

  const openRevenueCatPaywall = useCallback(async (): Promise<RevenueCatPaywallResult> => {
    setRevenueCatAccess((current) => ({
      ...current,
      isConfigured: isRevenueCatConfigured(),
      isLoading: true,
      error: null,
    }));

    try {
      const snapshot = await presentRevenueCatPaywall(revenueCatAppUserId);
      setRevenueCatAccess({
        ...snapshot,
        isConfigured: true,
        isLoading: false,
        error: null,
      });
      return snapshot;
    } catch (error) {
      setRevenueCatAccess((current) => ({
        ...current,
        isConfigured: isRevenueCatConfigured(),
        isLoading: false,
        error: "Unable to open RevenueCat paywall.",
      }));
      throw error;
    }
  }, [revenueCatAppUserId]);

  const restoreProviderSubscription = useCallback(async () => {
    setRevenueCatAccess((current) => ({
      ...current,
      isConfigured: isRevenueCatConfigured(),
      isLoading: true,
      error: null,
    }));

    try {
      const snapshot = await restoreRevenueCatPurchases(revenueCatAppUserId);
      setRevenueCatAccess({
        ...snapshot,
        isConfigured: true,
        isLoading: false,
        error: null,
      });
      return snapshot;
    } catch (error) {
      setRevenueCatAccess((current) => ({
        ...current,
        isConfigured: isRevenueCatConfigured(),
        isLoading: false,
        error: "Unable to restore purchases.",
      }));
      throw error;
    }
  }, [revenueCatAppUserId]);

  return useMemo(() => {
    const providerHasAdFree = serverAccess?.isAdFree === true;
    const revenueCatHasAdFree = revenueCatAccess.isAdFree;
    const isAdFree = providerHasAdFree || revenueCatHasAdFree || previewAccess;
    const source = providerHasAdFree
      ? serverAccess?.source ?? "provider"
      : revenueCatHasAdFree
        ? "revenuecat"
      : previewAccess
        ? "preview"
        : "free";

    return {
      isLoading:
        serverAccess === undefined || !isPreviewLoaded || revenueCatAccess.isLoading,
      isAdFree,
      shouldShowAds: monetizationConfig.adsEnabled && !isAdFree,
      source,
      status:
        serverAccess?.status ??
        (revenueCatHasAdFree || previewAccess ? "active" : "none"),
      currentPeriodEnd:
        serverAccess?.currentPeriodEnd ?? revenueCatAccess.currentPeriodEnd,
      revenueCat: {
        isConfigured: revenueCatAccess.isConfigured,
        isLoading: revenueCatAccess.isLoading,
        error: revenueCatAccess.error,
        entitlementId: revenueCatAccess.activeEntitlementId,
        productIdentifier: revenueCatAccess.productIdentifier,
        restoreAvailable: Platform.OS !== "web",
      },
      startPreviewSubscription,
      clearPreviewSubscription,
      refreshRevenueCatAccess,
      openRevenueCatPaywall,
      restoreProviderSubscription,
    };
  }, [
    clearPreviewSubscription,
    isPreviewLoaded,
    openRevenueCatPaywall,
    previewAccess,
    refreshRevenueCatAccess,
    restoreProviderSubscription,
    revenueCatAccess,
    serverAccess,
    startPreviewSubscription,
  ]);
}
