import { useState, useEffect } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

/**
 * Detects mobile vs desktop using the same breakpoint as Tailwind's `md:`.
 * Returns `isReady: false` during SSR/hydration to prevent flash.
 */
export function useIsMobile(): { isMobile: boolean; isReady: boolean } {
  const [isMobile, setIsMobile] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mq.matches);
    setIsReady(true);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return { isMobile, isReady };
}
