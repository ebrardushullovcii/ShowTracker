import Constants from "expo-constants";

type GoogleMobileAdsModule = typeof import("react-native-google-mobile-ads");

let googleMobileAdsModule: GoogleMobileAdsModule | null | undefined;

let initializePromise: Promise<unknown> | null = null;

export function getGoogleMobileAdsModule() {
  if (Constants.appOwnership === "expo") {
    return null;
  }

  if (googleMobileAdsModule !== undefined) {
    return googleMobileAdsModule;
  }

  try {
    googleMobileAdsModule =
      require("react-native-google-mobile-ads") as GoogleMobileAdsModule;
  } catch {
    googleMobileAdsModule = null;
  }

  return googleMobileAdsModule;
}

export function initializeGoogleMobileAds() {
  const adsModule = getGoogleMobileAdsModule();

  if (!adsModule) {
    return Promise.resolve(false);
  }

  initializePromise ??= adsModule.default()
    .setRequestConfiguration({
      maxAdContentRating: adsModule.MaxAdContentRating.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    })
    .then(() => adsModule.default().initialize());

  return initializePromise;
}
