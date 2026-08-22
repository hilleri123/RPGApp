'use client';

import { useScenarioObjectsList } from '../useScenarioObjectsList';
import type { NPCList } from '@/app/services/types2';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';

export function useNpcsList(scenarioId: string, opts?: { enabled?: boolean }) {
  return useScenarioObjectsList<NPCList>({
    scenarioId,
    enabled: opts?.enabled,
    load: (api: ScenarioScopedApiService) => api.getNpcs(),
    sort: (xs) => [...xs].sort((a: any, b: any) => String(a.name ?? '').localeCompare(String(b.name ?? ''))),
    remove: (api, id) => api.deleteNpc(id),
  });
}
