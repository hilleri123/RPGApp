'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type Options<T extends string> = {
  paramName?: string;
  /** Omit param from URL when value equals default */
  omitDefault?: boolean;
};

export function useUrlTab<T extends string>(
  allowed: readonly T[],
  defaultTab: T,
  options?: Options<T>,
): [T, (tab: T) => void] {
  const paramName = options?.paramName ?? 'tab';
  const omitDefault = options?.omitDefault ?? true;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const allowedSet = useMemo(() => new Set<string>(allowed), [allowed]);

  const tab = useMemo(() => {
    const raw = searchParams.get(paramName);
    if (raw && allowedSet.has(raw)) {
      return raw as T;
    }
    return defaultTab;
  }, [searchParams, paramName, allowedSet, defaultTab]);

  const setTab = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      if (omitDefault && next === defaultTab) {
        params.delete(paramName);
      } else {
        params.set(paramName, next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, paramName, defaultTab, omitDefault],
  );

  return [tab, setTab];
}
