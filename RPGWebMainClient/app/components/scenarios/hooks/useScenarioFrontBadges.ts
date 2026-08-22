'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import type { FrontBadgeInfo, FrontListItem } from '@/app/services/types2';

const cache = new Map<string, FrontBadgeInfo[]>();

/** Load front badges for scenario entity cards (by tag_key). */
export function useScenarioFrontBadges(scenarioId: string | undefined) {
  const [fronts, setFronts] = useState<FrontBadgeInfo[]>(() =>
    scenarioId ? cache.get(scenarioId) ?? [] : [],
  );

  const reload = useCallback(async () => {
    if (!scenarioId) return;
    const api = new ScenarioScopedApiService(scenarioId);
    const rows: FrontListItem[] = await api.getFronts();
    const badges: FrontBadgeInfo[] = rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      color: r.color || '#7c3aed',
      icon_url: r.icon_url ?? null,
      tag_key: r.tag_key ?? null,
    }));
    cache.set(scenarioId, badges);
    setFronts(badges);
  }, [scenarioId]);

  useEffect(() => {
    void reload().catch(() => setFronts([]));
  }, [reload]);

  return { fronts, reload };
}

export function useFrontsByTagKey(fronts: FrontBadgeInfo[]) {
  return useMemo(() => {
    const m = new Map<string, FrontBadgeInfo>();
    for (const f of fronts) {
      if (f.tag_key) m.set(f.tag_key, f);
    }
    return m;
  }, [fronts]);
}
