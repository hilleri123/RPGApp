'use client';

import { useEffect, useState } from "react";

export function useIsMobilePortrait(maxWidth = 800): boolean {
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(max-width: ${maxWidth}px) and (orientation: portrait)`
    );
    setIsMobilePortrait(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobilePortrait(e.matches);

    if (mediaQuery.addEventListener) {
      // Современные браузеры
      mediaQuery.addEventListener("change", handler);
    } else if ((mediaQuery as any).addListener) {
      // Старые Safari
      (mediaQuery as any).addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handler);
      } else if ((mediaQuery as any).removeListener) {
        (mediaQuery as any).removeListener(handler);
      }
    };
  }, [maxWidth]);

  return isMobilePortrait;
}
