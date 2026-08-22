import { useEffect, useRef } from 'react';
import { TabKey } from '../../ScenarioContext';

export function useTabCountEffect(
  tab: TabKey,
  count: number,
  setTabCount: (tab: TabKey, count: number) => void
) {
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevRef.current === count) return;
    prevRef.current = count;
    setTabCount(tab, count);
  }, [tab, count, setTabCount]);
}
