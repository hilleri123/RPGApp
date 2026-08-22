'use client';

import { useScenarioObjectsList } from '../useScenarioObjectsList';
import type { Counter } from '@/app/services/types2';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';

export function useCountersList(scenarioId: string, opts?: { enabled?: boolean }) {
  return useScenarioObjectsList<Counter>({
    scenarioId,
    enabled: opts?.enabled,
    load: (api) => api.getCounters(),
    remove: (api, id) => api.deleteCounter(id),
  });
}
