import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";

type NetworkAdBannerProps = {
  placement: string;
  className?: string;
  compact?: boolean;
};

type GptSize = [number, number];
type GptSlot = {
  addService: (service: unknown) => GptSlot;
  getSlotElementId?: () => string;
  setConfig?: (config: unknown) => GptSlot;
};
type GptSlotRenderEndedEvent = {
  slot: GptSlot;
  isEmpty: boolean;
};
type GptPubAdsService = {
  setPrivacySettings?: (config: {
    nonPersonalizedAds?: boolean;
    restrictDataProcessing?: boolean;
  }) => void;
  addEventListener?: (
    eventType: "slotRenderEnded",
    listener: (event: GptSlotRenderEndedEvent) => void
  ) => void;
  removeEventListener?: (
    eventType: "slotRenderEnded",
    listener: (event: GptSlotRenderEndedEvent) => void
  ) => void;
  enableSingleRequest?: () => void;
};
type GoogleTag = {
  cmd: (() => void)[];
  defineSlot: (
    adUnitPath: string,
    size: GptSize | GptSize[],
    divId: string
  ) => GptSlot | null;
  pubads: () => GptPubAdsService;
  setConfig?: (config: unknown) => void;
  enableServices: () => void;
  display: (divId: string) => void;
  destroySlots?: (slots: GptSlot[]) => boolean;
};

declare global {
  interface Window {
    googletag?: GoogleTag;
  }
}

const GPT_SCRIPT_ID = "showtracker-gpt-script";
const GPT_SCRIPT_SRC = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
const GPT_TEST_AD_UNIT_PATH = "/6355419/Travel/Europe/France/Paris";
const DEFAULT_GPT_SIZES: GptSize[] = [[300, 250]];
const useTestAds = process.env.EXPO_PUBLIC_GPT_TEST_ADS !== "false";
const gptAdUnitPathsByPlacement: Record<string, string | undefined> = {
  home_top: process.env.EXPO_PUBLIC_GPT_HOME_TOP_AD_UNIT_PATH,
  home_inline: process.env.EXPO_PUBLIC_GPT_HOME_INLINE_AD_UNIT_PATH,
  schedule_top: process.env.EXPO_PUBLIC_GPT_SCHEDULE_TOP_AD_UNIT_PATH,
  profile: process.env.EXPO_PUBLIC_GPT_PROFILE_AD_UNIT_PATH,
};
let slotCounter = 0;
let gptScriptPromise: Promise<GoogleTag> | null = null;
let gptServicesEnabled = false;

function createSlotId() {
  slotCounter += 1;
  return `showtracker-gpt-ad-${slotCounter}`;
}

function parseGptSizes(value: string | undefined) {
  const sizes = value
    ?.split(",")
    .map((entry) => {
      const match = /^(\d{2,4})x(\d{2,4})$/.exec(entry.trim());
      if (!match) {
        return null;
      }
      return [Number(match[1]), Number(match[2])] as GptSize;
    })
    .filter((entry): entry is GptSize => Boolean(entry));

  return sizes?.length ? sizes : DEFAULT_GPT_SIZES;
}

function getAdUnitPath(placement: string) {
  if (useTestAds) {
    return GPT_TEST_AD_UNIT_PATH;
  }

  const placementSpecific = gptAdUnitPathsByPlacement[placement]?.trim();

  return (
    placementSpecific ||
    process.env.EXPO_PUBLIC_GPT_AD_UNIT_PATH?.trim() ||
    GPT_TEST_AD_UNIT_PATH
  );
}

function ensureGoogleTag() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  window.googletag ??= { cmd: [] } as unknown as GoogleTag;
  return window.googletag;
}

function loadGooglePublisherTag() {
  const existingTag = ensureGoogleTag();
  if (!existingTag) {
    return Promise.reject(new Error("Google Publisher Tag requires a browser."));
  }

  gptScriptPromise ??= new Promise<GoogleTag>((resolve, reject) => {
    const existingScript = document.getElementById(GPT_SCRIPT_ID);
    if (existingScript) {
      resolve(existingTag);
      return;
    }

    const script = document.createElement("script");
    script.id = GPT_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "strict-origin-when-cross-origin";
    script.src = GPT_SCRIPT_SRC;
    script.addEventListener("load", () => resolve(existingTag), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Google Publisher Tag failed to load.")),
      { once: true }
    );
    document.head.appendChild(script);
  });

  return gptScriptPromise;
}

function enableGooglePublisherTagServices(gpt: GoogleTag) {
  if (gptServicesEnabled) {
    return;
  }

  const pubads = gpt.pubads();
  pubads.setPrivacySettings?.({
    nonPersonalizedAds: true,
    restrictDataProcessing: true,
  });

  if (gpt.setConfig) {
    gpt.setConfig({
      collapseDiv: "ON_NO_FILL",
      lazyLoad: {
        fetchMarginPercent: 100,
        renderMarginPercent: 50,
        mobileScaling: 2,
      },
      singleRequest: true,
      privacyTreatments: { treatments: ["disablePersonalization"] },
    });
  } else {
    pubads.enableSingleRequest?.();
  }

  gpt.enableServices();
  gptServicesEnabled = true;
}

export function NetworkAdBanner({
  placement,
  className,
  compact,
}: NetworkAdBannerProps) {
  const slotRef = useRef<GptSlot | null>(null);
  const listenerRef = useRef<((event: GptSlotRenderEndedEvent) => void) | null>(
    null
  );
  const [slotId] = useState(createSlotId);
  const [status, setStatus] = useState<
    "loading" | "requested" | "rendered" | "empty" | "error"
  >("loading");
  const adUnitPath = useMemo(() => getAdUnitPath(placement), [placement]);
  const sizes = useMemo(
    () => parseGptSizes(process.env.EXPO_PUBLIC_GPT_BANNER_SIZES),
    []
  );
  const primarySize = sizes[0] ?? DEFAULT_GPT_SIZES[0];

  useEffect(() => {
    let isMounted = true;

    void loadGooglePublisherTag()
      .then((gpt) => {
        gpt.cmd.push(() => {
          if (!isMounted) {
            return;
          }

          const slot = gpt.defineSlot(adUnitPath, sizes, slotId);
          if (!slot) {
            setStatus("error");
            return;
          }

          const pubads = gpt.pubads();
          const slotElementId = slot.getSlotElementId?.() ?? slotId;
          const listener = (event: GptSlotRenderEndedEvent) => {
            const eventSlotId = event.slot.getSlotElementId?.();
            if (
              !isMounted ||
              (event.slot !== slot && eventSlotId !== slotElementId)
            ) {
              return;
            }
            setStatus(event.isEmpty ? "empty" : "rendered");
          };

          listenerRef.current = listener;
          slotRef.current = slot;
          pubads.addEventListener?.("slotRenderEnded", listener);
          slot.addService(pubads);
          enableGooglePublisherTagServices(gpt);
          gpt.display(slotId);
          setStatus("requested");
        });
      })
      .catch(() => {
        if (isMounted) {
          setStatus("error");
        }
      });

    return () => {
      isMounted = false;
      const gpt = window.googletag;
      const listener = listenerRef.current;
      const slot = slotRef.current;
      if (gpt && listener) {
        gpt.pubads().removeEventListener?.("slotRenderEnded", listener);
      }
      if (gpt && slot) {
        gpt.destroySlots?.([slot]);
      }
      listenerRef.current = null;
      slotRef.current = null;
    };
  }, [adUnitPath, sizes, slotId]);

  useEffect(() => {
    if (status !== "loading" && status !== "requested") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatus((currentStatus) =>
        currentStatus === "loading" || currentStatus === "requested"
          ? "empty"
          : currentStatus
      );
    }, 8000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [status]);

  if (status === "empty" || status === "error") {
    return null;
  }

  const fallbackLabel =
    status === "loading" || status === "requested"
      ? "Loading network ad"
      : null;

  return (
    <View
      className={`items-center justify-center overflow-hidden rounded-xl border border-border-bright bg-bg-surface px-3 ${
        className ?? ""
      }`.trim()}
      style={{
        minHeight: primarySize[1] + (compact ? 32 : 40),
        paddingVertical: compact ? 10 : 12,
      }}
    >
      <Text
        className="mb-2 text-[10px] font-black uppercase text-text-muted"
        numberOfLines={1}
      >
        Advertisement
      </Text>
      <View
        nativeID={slotId}
        style={{
          width: primarySize[0],
          height: primarySize[1],
          maxWidth: "100%",
        }}
      />
      {fallbackLabel ? (
        <View className="absolute inset-0 items-center justify-center px-4">
          <Text className="text-xs font-semibold text-text-secondary" numberOfLines={1}>
            {fallbackLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
