'use client';

import { useScenarioObjectsList } from '../useScenarioObjectsList';
import type { Note } from '@/app/services/types2';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';

export function useNotesList(scenarioId: string, opts?: { enabled?: boolean }) {
  return useScenarioObjectsList<Note>({
    scenarioId,
    enabled: opts?.enabled,
    load: (api: ScenarioScopedApiService) => api.getNotes(),
    sort: (xs) =>
      [...xs].sort((a: any, b: any) => String(a.name ?? a.title ?? a.id).localeCompare(String(b.name ?? b.title ?? b.id))),
    remove: (api, id) => api.deleteNote(id),
  });
}
