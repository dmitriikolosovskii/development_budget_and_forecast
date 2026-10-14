import { useSyncExternalStore } from 'react';

export const MOBILE_QUERY = '(max-width: 639px)';
export const TABLET_QUERY = '(max-width: 1023px)';

/** Subscribes to a CSS media query; `false` where matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia?.(query);
      mql?.addEventListener?.('change', onChange);
      return () => mql?.removeEventListener?.('change', onChange);
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
