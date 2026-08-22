'use client';

import { useScenarioObjectsList } from '../useScenarioObjectsList';
import type { LocationList } from '@/app/services/types2';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';

export function useLocationsList(scenarioId: string, opts?: { enabled?: boolean }) {
  return useScenarioObjectsList<LocationList>({
    scenarioId,
    enabled: opts?.enabled,
    load: (api: ScenarioScopedApiService) => api.getLocations(),
    sort: (xs) => [...xs].sort((a: any, b: any) => String(a.name ?? '').localeCompare(String(b.name ?? ''))),
    remove: (api, id) => api.deleteLocation(id),
  });
}
