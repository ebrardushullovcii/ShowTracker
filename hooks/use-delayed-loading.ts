import { useEffect, useState } from "react";

const LOADING_INDICATOR_DELAY_MS = 250;

export function useDelayedLoading(isLoading: boolean) {
  const [delayElapsed, setDelayElapsed] = useState(false);

  useEffect(() => {
    if (!isLoading) return;

    const timer = setTimeout(() => setDelayElapsed(true), LOADING_INDICATOR_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setDelayElapsed(false);
    };
  }, [isLoading]);

  return isLoading && delayElapsed;
}
