'use client';

import { useScenarioObjectDialog } from '../useScenarioObjectDialog';
import type { Counter, CounterCreate, CounterUpdate, PlayerCharacterList } from '@/app/services/types2';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';

type CounterForm = CounterCreate | CounterUpdate;

type CounterLookups = {
  characters: PlayerCharacterList[];
};

export function useCounterDialog(opts: {
  open: boolean;
  scenarioId: string;
  counterId: string | null;
  /** Prefill / lock create form to this character (ignored when editing existing). */
  defaultCharacterId?: string | null;
  onSaved?: (id: string) => void;
}) {
  const defaultCharacterId = opts.defaultCharacterId ?? null;

  return useScenarioObjectDialog<Counter, CounterForm, CounterLookups, CounterForm, undefined>({
    open: opts.open,
    scenarioId: opts.scenarioId,
    objectId: opts.counterId,
    onSaved: opts.onSaved,

    loadFull: (api: ScenarioScopedApiService, id: string) => api.getCounter(id),

    loadLookups: async (api: ScenarioScopedApiService) => {
      const characters = await api.getCharacters({ skip: 0, limit: 1000 });
      return { characters };
    },

    init: (full) => ({
      form: {
        name: full?.name ?? '',
        description: (full as any)?.description ?? null,
        value: (full as any)?.value ?? 0,
        min_value: (full as any)?.min_value ?? null,
        max_value: (full as any)?.max_value ?? null,
        character_id: (full as any)?.character_id ?? defaultCharacterId ?? null,
      },
      assets: undefined,
    }),

    empty: () => ({
      form: {
        name: '',
        description: null,
        value: 0,
        min_value: null,
        max_value: null,
        character_id: defaultCharacterId,
      },
      assets: undefined,
    }),

    buildPayload: (form) => {
      if (!opts.counterId && defaultCharacterId) {
        return { ...form, character_id: defaultCharacterId };
      }
      return form;
    },

    create: (api, payload) => api.createCounter(payload as any),
    update: (api, id, payload) => api.updateCounter(id, payload as any),
  });
}
