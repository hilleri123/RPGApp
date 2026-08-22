'use client';

import type { PlayerCharacterList } from '@/app/services/types2';
import { useScenarioObjectsList } from '../useScenarioObjectsList';

export function useCharactersList(scenarioId: string, opts?: { enabled?: boolean }) {
  return useScenarioObjectsList<PlayerCharacterList>({
    scenarioId,
    enabled: opts?.enabled ?? true,
    load: (api) => api.getCharacters({ skip: 0, limit: 1000 }),
    remove: (api, id) => api.deleteCharacter(id),
  });
}
