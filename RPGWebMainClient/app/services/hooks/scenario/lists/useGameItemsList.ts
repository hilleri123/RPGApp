'use client';

import { useScenarioObjectsList } from '../useScenarioObjectsList';
import type { GameItemWithOwnerShort } from '@/app/services/types2';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';

export function useGameItemsList(scenarioId: string, opts?: { enabled?: boolean }) {
  return useScenarioObjectsList<GameItemWithOwnerShort>({
    scenarioId,
    enabled: opts?.enabled,
    load: (api: ScenarioScopedApiService) => api.getItemsWithOwner(),
    sort: (xs) => [...xs].sort((a: any, b: any) => String(a.name ?? '').localeCompare(String(b.name ?? ''))),
    remove: (api, id) => api.deleteItem(id),
  });
}
