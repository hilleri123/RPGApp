'use client';

import { useScenarioObjectsList } from '../useScenarioObjectsList';
import type { StoryBeatList } from '@/app/services/types2';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';

export function useStoryBeatsList(scenarioId: string, opts?: { enabled?: boolean }) {
  return useScenarioObjectsList<StoryBeatList>({
    scenarioId,
    enabled: opts?.enabled,
    load: (api: ScenarioScopedApiService) => api.getStoryBeats({ skip: 0, limit: 1000 }),
    sort: (xs) => [...xs].sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0)),
    remove: (api, id) => api.deleteStoryBeat(id),
  });
}
