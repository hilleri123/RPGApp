'use client';

import { useScenarioObjectDialog } from '../useScenarioObjectDialog';
import type { GameItem, ItemUpsertPayload, GameItemWithOwnerShort, EntityKind } from '@/app/services/types2';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';

type ItemAssets = { iconFile: File | null; imgFile: File | null };
type ItemLookups = { items: GameItemWithOwnerShort[] };

export function useGameItemDialog(opts: {
  open: boolean;
  scenarioId: string;
  itemId: string | null;
  onSaved?: (id: string) => void;
}) {
  return useScenarioObjectDialog<GameItem, ItemUpsertPayload, ItemLookups, ItemUpsertPayload, ItemAssets>({
    open: opts.open,
    scenarioId: opts.scenarioId,
    objectId: opts.itemId,
    onSaved: opts.onSaved,

    loadFull: (api: ScenarioScopedApiService, id: string) => api.getItem(id),
    loadLookups: async (api: ScenarioScopedApiService) => {
      const items = await api.getItemsWithOwner({ skip: 0, limit: 1000 });
      return { items };
    },

    init: (full) => ({
      form: {
        force: false,
        name: full?.name ?? '',
        description_for_master: full?.description_for_master ?? null,
        description_for_players: full?.description_for_players ?? null,
        quest_html_mark: full?.quest_html_mark ?? undefined,
        icon_url: full?.icon_url ?? null,
        img_url: full?.img_url ?? null,
        tags: full?.tags || [],
        data: full?.data ?? {},
        contained_items: (full?.owned_items ?? []).map((x: any) => ({
          item_id: x.item?.id ?? x.item_id,
          qty: x.qty ?? 1,
        })),
      },
      assets: { iconFile: null, imgFile: null },
    }),
    empty: () => ({
      form: {
        force: false,
        name: '',
        description_for_master: null,
        description_for_players: null,
        quest_html_mark: undefined,
        icon_url: null,
        img_url: null,
        tags: [],
        data: {},
        contained_items: [],
      },
      assets: { iconFile: null, imgFile: null },
    }),

    buildPayload: (form, force) => {
      const { contained_items: _items, ...rest } = form as any;
      return { ...rest, force, contained_items: form.contained_items ?? [] };
    },

    create: (api, payload, assets) =>
      api.createItem(payload as any, { iconFile: assets.iconFile ?? null, imgFile: assets.imgFile ?? null }),
    update: (api, id, payload, assets) =>
      api.updateItem(id, payload as any, { iconFile: assets.iconFile ?? null, imgFile: assets.imgFile ?? null }),

    rules: {
      loadConfigFor: ['item'] as EntityKind[],
      context: { /* если нужно */ },
      validate: async (api, form) => {
        const payload = { ...(form as any), force: false };
        const res = await api.validateItem(payload);
        return { ok: !!res.ok, issues: (res.issues ?? []) as any, data: (res as any).data };
      },
    }
  });
}
