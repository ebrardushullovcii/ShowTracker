import { useEffect, useMemo, useState } from "react";
import { Platform, Text, View } from "react-native";
import {
  getGoogleMobileAdsModule,
  initializeGoogleMobileAds,
} from "@/lib/monetization/google-mobile-ads";

type NetworkAdBannerProps = {
  placement: string;
  className?: string;
  compact?: boolean;
};

const useTestAds = process.env.EXPO_PUBLIC_ADMOB_TEST_ADS !== "false";
const AD_LOAD_TIMEOUT_MS = 30000;

function getProductionUnitId() {
  const fallbackUnitId = process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID?.trim();
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID?.trim() || fallbackUnitId;
  }
  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID?.trim() || fallbackUnitId;
  }
  return fallbackUnitId;
}

export function NetworkAdBanner({
  className,
  compact,
}: NetworkAdBannerProps) {
  const [isReady, setIsReady] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const adsModule = useMemo(() => getGoogleMobileAdsModule(), []);
  const unitId = useMemo(() => {
    if (!adsModule) {
      return null;
    }

    const productionUnitId = getProductionUnitId();
    if (useTestAds || !productionUnitId) {
      return adsModule.TestIds.BANNER;
    }

    return productionUnitId;
  }, [adsModule]);

  const BannerAd = adsModule?.BannerAd;
  const bannerSize = adsModule?.BannerAdSize.BANNER;

  useEffect(() => {
    let isMounted = true;

    if (!adsModule) {
      setLoadError("AdMob requires a development build.");
      return () => {
        isMounted = false;
      };
    }

    void initializeGoogleMobileAds()
      .then((initialized) => {
        if (!isMounted) {
          return;
        }
        if (initialized) {
          setIsReady(true);
        } else {
          setLoadError("Ad network failed to initialize.");
        }
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setLoadError("Ad network failed to initialize.");
      });

    return () => {
      isMounted = false;
    };
  }, [adsModule]);

  useEffect(() => {
    if (hasLoaded || loadError) {
      return;
    }

    const timeout = setTimeout(() => {
      setLoadError("Ad network did not fill before timeout.");
    }, AD_LOAD_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [hasLoaded, loadError]);

  if (loadError) {
    return null;
  }

  return (
    <View
      className={`items-center justify-center overflow-hidden rounded-xl border border-border-bright bg-bg-surface ${
        className ?? ""
      }`.trim()}
      style={{ minHeight: compact ? 62 : 74 }}
    >
      {isReady && BannerAd && bannerSize && unitId ? (
        <BannerAd
          unitId={unitId}
          size={bannerSize}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => {
            setHasLoaded(true);
            setLoadError(null);
          }}
          onAdFailedToLoad={() => {
            setHasLoaded(false);
            setLoadError("Ad network failed to fill.");
          }}
        />
      ) : null}

      {!isReady || !hasLoaded ? (
        <View className="absolute inset-0 items-center justify-center px-4">
          <Text className="text-xs font-semibold text-text-secondary">
            Loading AdMob ad
          </Text>
        </View>
      ) : null}
    </View>
  );
}
