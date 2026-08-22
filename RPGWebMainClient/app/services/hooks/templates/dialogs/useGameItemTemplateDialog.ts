'use client';

import { RuleTemplatesApiService } from '@/app/services/api/templates';
import { useTemplateObjectDialog, type ValidateResult } from '../useTemplateObjectDialog';
import type {
  GameItem,
  ItemUpsertPayload,
  GameItemWithOwnerShort,
  EntityKind,
  ItemUpsertResult,
} from '@/app/services/types2';

type ItemAssets = { iconFile: File | null; imgFile: File | null };
type ItemLookups = { items: GameItemWithOwnerShort[] };

export function useGameItemTemplateDialog(opts: {
  open: boolean;
  templateSetId: string;
  itemId: string | null;
  onSaved?: (id: string) => void;
}) {
  return useTemplateObjectDialog<GameItem, ItemUpsertPayload, ItemLookups, ItemUpsertPayload, ItemAssets>({
    open: opts.open,
    templateSetId: opts.templateSetId,
    objectId: opts.itemId,
    onSaved: opts.onSaved,

    loadFull: (api: RuleTemplatesApiService, id: string) => api.getItemTemplate(id),

    loadLookups: async (api: RuleTemplatesApiService) => {
      const items = await api.getItemTemplates({ skip: 0, limit: 1000 });
      return { items };
    },

    init: (full) => ({
      form: {
        force: false,
        name: (full as any)?.name ?? '',
        description_for_master: (full as any)?.description_for_master ?? null,
        description_for_players: (full as any)?.description_for_players ?? null,
        quest_html_mark: full?.quest_html_mark ?? undefined,
        icon_url: (full as any)?.icon_url ?? null,
        img_url: (full as any)?.img_url ?? null,
        tags: (full as any)?.tags || [],
        data: (full as any)?.data ?? {},
        contained_items: ((full as any)?.owned_items ?? []).map((x: any) => ({
          item_id: x.item?.id ?? x.item_id,
          qty: x.qty ?? 1,
        })),
      } as any,
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
      } as any,
      assets: { iconFile: null, imgFile: null },
      lookups: { items: [] } as any,
    }),

    // ВАЖНО: сигнатура useTemplateObjectDialog: buildPayload(form, force, assets)
    buildPayload: (form: any, force: boolean, _assets: ItemAssets) => ({ ...form, force }) as ItemUpsertPayload,

    create: (api: RuleTemplatesApiService, payload: ItemUpsertPayload, assets: ItemAssets) =>
      api.createItemTemplate(payload as any, {
        iconFile: assets.iconFile ?? null,
        imgFile: assets.imgFile ?? null,
      }),

    update: (api: RuleTemplatesApiService, id: string, payload: ItemUpsertPayload, assets: ItemAssets) =>
      api.updateItemTemplate(id, payload as any, {
        iconFile: assets.iconFile ?? null,
        imgFile: assets.imgFile ?? null,
      }),

    rules: {
      loadConfigFor: ['item'] as EntityKind[],
      context: {},
      validate: async (api: RuleTemplatesApiService, form: ItemUpsertPayload): Promise<ValidateResult> => {
        const payload = { ...(form as any), force: false };
        const res: ItemUpsertResult = await api.validateItemTemplate(payload as any);
        return { ok: !!(res as any).ok, issues: ((res as any).issues ?? []) as any, data: (res as any).data };
      },
    },
  });
}
