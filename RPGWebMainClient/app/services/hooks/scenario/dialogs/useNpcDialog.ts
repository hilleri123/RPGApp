'use client';

import { useScenarioObjectDialog, type ValidateResult } from '../useScenarioObjectDialog';
import type {
  EntityKind,
  NPCOut,
  NPCUpsertPayload,
  NPCUpsertResult,
  GameItemWithOwnerShort,
} from '@/app/services/types2';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';

type NpcLookups = { items: GameItemWithOwnerShort[] };
type NpcAssets = { iconFile: File | null; imgFile: File | null };

export function useNpcDialog(opts: {
  open: boolean;
  scenarioId: string;
  npcId: string | null;
  onSaved?: (id: string) => void;
}) {
  const kind: EntityKind = 'npc';

  return useScenarioObjectDialog<NPCOut, NPCUpsertPayload, NpcLookups, NPCUpsertPayload, NpcAssets>({
    open: opts.open,
    scenarioId: opts.scenarioId,
    objectId: opts.npcId,
    onSaved: opts.onSaved,

    loadFull: (api: ScenarioScopedApiService, id: string) => api.getNpc(id),

    loadLookups: async (api: ScenarioScopedApiService) => {
      const items = await api.getItemsWithOwner({ skip: 0, limit: 1000 });
      return { items };
    },

    empty: () => ({
      form: {
        force: false,
        id: null,
        name: '',
        description_for_master: null,
        description_for_players: null,
        icon_url: null,
        img_url: null,
        tags: [],
        data: {},
        owned_items: [],
        take_from_other_owner_ids: [],
      },
      assets: { iconFile: null, imgFile: null },
      lookups: { items: [] },
    }),

    init: (full) => ({
      form: {
        force: false,
        id: full?.id ?? null,
        name: full?.name ?? '',
        description_for_master: full?.description_for_master ?? null,
        description_for_players: full?.description_for_players ?? null,
        icon_url: full?.icon_url ?? null,
        img_url: full?.img_url ?? null,
        tags: full?.tags || [],
        data: (full as any)?.data ?? {},
        owned_items: (full as any)?.owned_items ?? [],
        take_from_other_owner_ids: [],
      },
      assets: { iconFile: null, imgFile: null },
    }),

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
      } as any satisfies NPCUpsertPayload;
    },

    create: (api, payload, assets) =>
      api.createNpc(payload as any, { iconFile: assets.iconFile ?? null, imgFile: assets.imgFile ?? null }),

    update: (api, id, payload, assets) =>
      api.updateNpc(id, payload as any, { iconFile: assets.iconFile ?? null, imgFile: assets.imgFile ?? null }),

    rules: {
      loadConfigFor: [kind],
      context: {},
      validate: async (api: ScenarioScopedApiService, form: NPCUpsertPayload): Promise<ValidateResult> => {
        const payload = { ...(form as any), force: false };
        const res: NPCUpsertResult = await (api as any).validateNpc(payload);
        return { ok: !!(res as any).ok, issues: ((res as any).issues ?? []) as any, data: (res as any).data };
      },
    },
  });
}
