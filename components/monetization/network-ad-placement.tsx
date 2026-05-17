import { useMonetizationAccess } from "@/hooks/use-monetization-access";
import { NetworkAdBanner } from "@/components/monetization/network-ad-banner";

type AdPlacement = "home_top" | "home_inline" | "schedule_top" | "profile";

type NetworkAdPlacementProps = {
  placement: AdPlacement;
  className?: string;
  compact?: boolean;
};

export function NetworkAdPlacement({
  placement,
  className,
  compact,
}: NetworkAdPlacementProps) {
  const { isLoading, shouldShowAds } = useMonetizationAccess();

  if (isLoading || !shouldShowAds) {
    return null;
  }

  return (
    <NetworkAdBanner
      placement={placement}
      className={className}
      compact={compact}
    />
  );
}
