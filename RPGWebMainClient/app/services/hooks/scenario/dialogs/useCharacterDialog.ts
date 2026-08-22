'use client';

import { useCallback, useMemo } from 'react';
import { useScenarioObjectDialog, type ValidateResult } from '../useScenarioObjectDialog';
import type {
  PlayerCharacterOut,
  LocationList,
  CharacterUpsertPayload,
  CharacterUpsertResult,
  GameItemWithOwnerShort,
} from '@/app/services/types2';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import type { EntityKind } from '@/plugins/gumshoe/base/ui/src/types';

type CharacterLookups = {
  items: GameItemWithOwnerShort[];
  locations: LocationList[]; // если не нужно — убери
};

type CharacterAssets = { iconFile: File | null; imgFile: File | null };

export function useCharacterDialog(opts: {
  open: boolean;
  scenarioId: string;
  characterId: string | null;
  onSaved?: (characterId: string) => void;
}) {
  const kind: EntityKind = 'character';

  return useScenarioObjectDialog<
    PlayerCharacterOut,
    CharacterUpsertPayload,
    CharacterLookups,
    CharacterUpsertPayload,
    CharacterAssets
  >({
    open: opts.open,
    scenarioId: opts.scenarioId,
    objectId: opts.characterId,
    onSaved: opts.onSaved,

    empty: () => ({
      form: {
        force: false,
        id: null,
        name: '',
        short_desc: null,
        story: null,
        location_id: null,
        icon_url: null,
        img_url: null,
        tags: [],
        data: {},
        owned_items: [],
        take_from_other_owner_ids: [],
      } as any,
      assets: { iconFile: null, imgFile: null },
      lookups: { items: [], locations: [] } as any,
    }),

    loadLookups: async (api: ScenarioScopedApiService) => {
      const items = await api.getItemsWithOwner({ skip: 0, limit: 1000 });
      return { items, locations: [] as any };
    },

    loadFull: (api: ScenarioScopedApiService, id: string) => api.getCharacter(id),

    init: (full, lookups) => {
      const ownedItems = (full as any)?.owned_items ?? [];

      return {
        form: {
          force: false,
          id: full?.id ?? null,
          name: full?.name ?? '',
          short_desc: full?.short_desc ?? null,
          story: full?.story ?? null,
          location_id: full?.location_id ?? null,
          icon_url: full?.icon_url ?? null,
          img_url: full?.img_url ?? null,
          tags: full?.tags || [],
          data: (full as any)?.data ?? {},
          owned_items: ownedItems,
          take_from_other_owner_ids: [],
        } as any,
        assets: { iconFile: null, imgFile: null },
      };
    },

    buildPayload: (form: any, force) => {
      const takeSet = new Set<string>((form.take_from_other_owner_ids ?? []).map(String));
      const { take_from_other_owner_ids: _take, owned_items: _owned, ...rest } = form;

      return {
        ...rest,
        force,
        data: form.data ?? {},
        owned_items: (form.owned_items ?? []).map((it: any) => ({
          item_id: it.id,
          ...(takeSet.has(String(it.id)) ? { take_from_other_owner: true } : {}),
        })),
      } satisfies CharacterUpsertPayload;
    },

    create: (api, payload, assets) =>
      api.createCharacter(payload as any, {
        iconFile: assets.iconFile ?? null,
        imgFile: assets.imgFile ?? null,
      }),

    update: (api, id, payload, assets) =>
      api.updateCharacter(id, payload as any, {
        iconFile: assets.iconFile ?? null,
        imgFile: assets.imgFile ?? null,
      }),

    rules: {
      loadConfigFor: [kind],
      context: {},
      optionsContext: (form) => ({
        playbook_id: (form as any).data?.playbook_id ?? null,
        level: (form as any).data?.level ?? null,
      }),

      validate: async (api: ScenarioScopedApiService, form: CharacterUpsertPayload): Promise<ValidateResult> => {
        const payload = { ...form, force: false } as any;
        const res: CharacterUpsertResult = await api.validateCharacter(payload);

        return {
          ok: !!(res as any)?.ok,
          issues: ((res as any)?.issues ?? []) as any,
          data: (res as any)?.data,
        };
      },
    },
  });
}
