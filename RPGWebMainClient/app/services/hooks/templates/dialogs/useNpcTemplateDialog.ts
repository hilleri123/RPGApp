'use client';

import { useTemplateObjectDialog, type ValidateResult } from '../useTemplateObjectDialog';
import { RuleTemplatesApiService } from '@/app/services/api/templates';
import type {
  EntityKind,
  NPCOut,
  NPCUpsertPayload,
  NPCUpsertResult,
  GameItemWithOwnerShort,
} from '@/app/services/types2';

type NpcLookups = { items: GameItemWithOwnerShort[] };
type NpcAssets = { iconFile: File | null; imgFile: File | null };

export function useNpcTemplateDialog(opts: {
  open: boolean;
  templateSetId: string;
  npcId: string | null;
  onSaved?: (id: string) => void;
}) {
  const kind: EntityKind = 'npc';

  return useTemplateObjectDialog<NPCOut, NPCUpsertPayload, NpcLookups, NPCUpsertPayload, NpcAssets>({
    open: opts.open,
    templateSetId: opts.templateSetId,
    objectId: opts.npcId,
    onSaved: opts.onSaved,

    loadFull: (api: RuleTemplatesApiService, id: string) => api.getNpcTemplate(id),

    loadLookups: async (api: RuleTemplatesApiService) => {
      const items = await api.getItemTemplates({ skip: 0, limit: 1000 });
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
      } as any,
      assets: { iconFile: null, imgFile: null },
      lookups: { items: [] },
    }),

    init: (full) => ({
      form: {
        force: false,
        id: (full as any)?.id ?? null,
        name: (full as any)?.name ?? '',
        description_for_master: (full as any)?.description_for_master ?? null,
        description_for_players: (full as any)?.description_for_players ?? null,
        icon_url: (full as any)?.icon_url ?? null,
        img_url: (full as any)?.img_url ?? null,
        tags: full?.tags || [],
        data: (full as any)?.data ?? {},
        owned_items: (full as any)?.owned_items ?? [],
        take_from_other_owner_ids: [],
      } as any,
      assets: { iconFile: null, imgFile: null },
    }),

    buildPayload: (form: any, force: boolean, _assets: NpcAssets) => {
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
      } satisfies NPCUpsertPayload;
    },

    create: (api: RuleTemplatesApiService, payload: NPCUpsertPayload, assets: NpcAssets) =>
      api.createNpcTemplate(payload as any, {
        iconFile: assets.iconFile ?? null,
        imgFile: assets.imgFile ?? null,
      }),

    update: (api: RuleTemplatesApiService, id: string, payload: NPCUpsertPayload, assets: NpcAssets) =>
      api.updateNpcTemplate(id, payload as any, {
        iconFile: assets.iconFile ?? null,
        imgFile: assets.imgFile ?? null,
      }),

    rules: {
      loadConfigFor: [kind],
      context: {},
      validate: async (api: RuleTemplatesApiService, form: NPCUpsertPayload): Promise<ValidateResult> => {
        const payload = { ...(form as any), force: false };
        const res: NPCUpsertResult = await api.validateNpcTemplate(payload as any);
        return { ok: !!(res as any).ok, issues: ((res as any).issues ?? []) as any, data: (res as any).data };
      },
    },
  });
}
