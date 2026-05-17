import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ScreenWrapper } from "@/components/ScreenWrapper";
import { useMonetizationAccess } from "@/hooks/use-monetization-access";
import {
  SHOWTRACKER_PLUS_PRICE,
  monetizationConfig,
  plusBenefits,
} from "@/lib/monetization/config";
import { DESKTOP_SIDEBAR_BREAKPOINT } from "@/constants/navigation";

function BenefitRow({ text }: { text: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-lg bg-success/15">
        <Ionicons name="checkmark" size={14} color="#34d399" />
      </View>
      <Text className="flex-1 text-sm leading-5 text-text-secondary">{text}</Text>
    </View>
  );
}

export default function SubscribeScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= DESKTOP_SIDEBAR_BREAKPOINT;
  const {
    isLoading,
    isAdFree,
    source,
    revenueCat,
    startPreviewSubscription,
    clearPreviewSubscription,
    openRevenueCatPaywall,
    restoreProviderSubscription,
  } = useMonetizationAccess();
  const [isStarting, setIsStarting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const shouldOpenRevenueCatPaywall =
    revenueCat.isConfigured &&
    (Platform.OS !== "web" || monetizationConfig.revenueCatWebPaywallEnabled);

  const openCheckout = async () => {
    setError(null);
    setNotice(null);
    setIsStarting(true);
    try {
      if (shouldOpenRevenueCatPaywall) {
        const result = await openRevenueCatPaywall();
        if (result.isAdFree) {
          setNotice("ShowTracker Plus is active on this account.");
          return;
        }

        if (monetizationConfig.demoCheckoutEnabled) {
          await startPreviewSubscription();
          setNotice("RevenueCat did not return an active entitlement, so local ad-free preview is active.");
          return;
        }

        setNotice("Paywall closed without an active Plus entitlement.");
        return;
      }

      if (monetizationConfig.checkoutUrl) {
        await Linking.openURL(monetizationConfig.checkoutUrl);
        return;
      }

      if (!monetizationConfig.demoCheckoutEnabled) {
        setError("Checkout is not configured yet.");
        return;
      }

      await startPreviewSubscription();
      setNotice("Local ad-free preview is active.");
    } catch {
      if (monetizationConfig.demoCheckoutEnabled) {
        await startPreviewSubscription();
        setNotice("RevenueCat paywall is not ready yet, so local ad-free preview is active.");
        return;
      }

      setError("Unable to open checkout. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const clearPreview = async () => {
    setIsStarting(true);
    setError(null);
    setNotice(null);
    try {
      await clearPreviewSubscription();
    } finally {
      setIsStarting(false);
    }
  };

  const restoreSubscription = async () => {
    setIsRestoring(true);
    setError(null);
    setNotice(null);
    try {
      const result = await restoreProviderSubscription();
      setNotice(
        result.isAdFree
          ? "ShowTracker Plus was restored."
          : "No active Plus purchase was found."
      );
    } catch {
      setError("Unable to restore purchases. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  };

  const primaryButtonLabel = isAdFree
    ? "Plus is active"
    : shouldOpenRevenueCatPaywall
      ? "Open RevenueCat paywall"
      : revenueCat.isConfigured && monetizationConfig.demoCheckoutEnabled
        ? "Test ad-free subscription"
      : monetizationConfig.checkoutUrl
        ? "Subscribe"
        : "Start ad-free preview";

  const accessDetail = isAdFree
    ? source === "preview"
      ? "Local preview entitlement"
      : source === "revenuecat"
        ? `RevenueCat: ${revenueCat.entitlementId ?? monetizationConfig.revenueCatEntitlementId}`
        : `Provider: ${source}`
    : revenueCat.isConfigured
      ? shouldOpenRevenueCatPaywall
        ? "RevenueCat paywall is ready"
        : "RevenueCat configured; web preview uses test checkout"
      : "Network ads are visible";

  return (
    <ScreenWrapper>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="mb-4 flex-row items-center justify-between">
          <Link href="/profile" asChild>
            <Pressable className="flex-row items-center gap-1.5 rounded-full border border-border-default bg-bg-surface px-3 py-2">
              <Ionicons name="chevron-back" size={15} color="#a1a1aa" />
              <Text className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                Profile
              </Text>
            </Pressable>
          </Link>
          <View className="rounded-full border border-border-default bg-bg-surface px-3 py-2">
            <Text className="text-[10px] font-black uppercase tracking-[1.4px] text-text-muted">
              {isAdFree ? "Ad-free" : "Ad-supported"}
            </Text>
          </View>
        </View>

        <View className={`gap-4 ${isDesktop ? "flex-row" : ""}`}>
          <View className={`${isDesktop ? "flex-[1.1]" : ""} overflow-hidden rounded-xl border border-border-default bg-bg-surface`}>
            <LinearGradient
              colors={["rgba(239,68,68,0.18)", "rgba(249,115,22,0.1)", "rgba(9,9,11,0.98)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: isDesktop ? 28 : 20 }}
            >
              <View className="max-w-2xl">
                <Text className="text-xs font-black uppercase tracking-[1.8px] text-primary">
                  ShowTracker Plus
                </Text>
                <Text
                  className={`${isDesktop ? "text-5xl" : "text-4xl"} mt-3 font-black tracking-tight text-text-primary`}
                >
                  Remove network ads.
                </Text>
                <Text className="mt-3 max-w-xl text-sm leading-6 text-text-secondary">
                  Keep the tracker fast and focused while supporting the app with a simple monthly plan.
                </Text>

                <View className="mt-6 flex-row items-end gap-2">
                  <Text className="text-5xl font-black text-text-primary">
                    {SHOWTRACKER_PLUS_PRICE}
                  </Text>
                  <Text className="pb-1 text-sm font-semibold text-text-secondary">/ month</Text>
                </View>

                <View className="mt-6 gap-3">
                  {plusBenefits.map((benefit) => (
                    <BenefitRow key={benefit} text={benefit} />
                  ))}
                </View>

                <View className="mt-7 gap-3">
                  <Pressable
                    accessibilityRole="button"
                    disabled={isLoading || isStarting || isAdFree}
                    onPress={openCheckout}
                    className="items-center justify-center rounded-xl border-2 border-primary bg-primary px-5 py-3.5"
                    style={{ opacity: isLoading || isStarting || isAdFree ? 0.65 : 1 }}
                  >
                    {isStarting ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text className="text-sm font-black uppercase tracking-wide text-white">
                        {primaryButtonLabel}
                      </Text>
                    )}
                  </Pressable>

                  {revenueCat.isConfigured && revenueCat.restoreAvailable ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isLoading || isRestoring}
                      onPress={restoreSubscription}
                      className="items-center justify-center rounded-xl border border-border-bright bg-bg-elevated px-5 py-3"
                      style={{ opacity: isLoading || isRestoring ? 0.65 : 1 }}
                    >
                      {isRestoring ? (
                        <ActivityIndicator size="small" color="#a1a1aa" />
                      ) : (
                        <Text className="text-xs font-black uppercase tracking-wide text-text-secondary">
                          Restore purchases
                        </Text>
                      )}
                    </Pressable>
                  ) : null}

                  {source === "preview" ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isStarting}
                      onPress={clearPreview}
                      className="items-center justify-center rounded-xl border border-border-bright bg-bg-elevated px-5 py-3"
                    >
                      <Text className="text-xs font-black uppercase tracking-wide text-text-secondary">
                        Return to ad-supported preview
                      </Text>
                    </Pressable>
                  ) : null}

                  {notice ? <Text className="text-sm text-success">{notice}</Text> : null}
                  {error ? <Text className="text-sm text-primary">{error}</Text> : null}
                </View>
              </View>
            </LinearGradient>
          </View>

          <View className={`${isDesktop ? "w-[340px]" : ""} gap-4`}>
            <View className="rounded-xl border border-border-default bg-bg-surface p-4">
              <Text className="text-xs font-black uppercase tracking-[1.5px] text-text-muted">
                Current Access
              </Text>
              <View className="mt-4 flex-row items-center gap-3">
                <View
                  className={`h-11 w-11 items-center justify-center rounded-xl ${
                    isAdFree ? "bg-success/15" : "bg-bg-elevated"
                  }`}
                >
                  <Ionicons
                    name={isAdFree ? "shield-checkmark-outline" : "radio-outline"}
                    size={20}
                    color={isAdFree ? "#34d399" : "#a1a1aa"}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-black text-text-primary">
                    {isAdFree ? "Ad-free" : "Free with ads"}
                  </Text>
                  <Text className="mt-0.5 text-xs text-text-secondary">
                    {accessDetail}
                  </Text>
                </View>
              </View>
            </View>

            <View className="rounded-xl border border-border-default bg-bg-surface p-4">
              <Text className="text-xs font-black uppercase tracking-[1.5px] text-text-muted">
                Billing
              </Text>
              <View className="mt-4 gap-3">
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="text-sm font-semibold text-text-secondary">Provider</Text>
                  <Text className="text-sm font-black text-text-primary">
                    {revenueCat.isConfigured ? "RevenueCat" : monetizationConfig.billingProvider}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="text-sm font-semibold text-text-secondary">Entitlement</Text>
                  <Text className="text-sm font-black text-text-primary">
                    {revenueCat.entitlementId ?? monetizationConfig.revenueCatEntitlementId}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="text-sm font-semibold text-text-secondary">Plan</Text>
                  <Text className="text-sm font-black text-text-primary">
                    {SHOWTRACKER_PLUS_PRICE}/mo
                  </Text>
                </View>
              </View>
              {revenueCat.error ? (
                <Text className="mt-3 text-xs leading-5 text-primary">{revenueCat.error}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
