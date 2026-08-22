'use client';

import { RuleTemplatesApiService } from '@/app/services/api/templates';
import { useTemplateObjectDialog, type ValidateResult } from '../useTemplateObjectDialog';
import type {
  PlayerCharacterOut,
  LocationList,
  CharacterUpsertPayload,
  CharacterUpsertResult,
  GameItemWithOwnerShort,
} from '@/app/services/types2';
import type { EntityKind } from '@/plugins/gumshoe/base/ui/src/types';

type CharacterLookups = {
  items: GameItemWithOwnerShort[];
  locations: LocationList[];
};

type CharacterAssets = { iconFile: File | null; imgFile: File | null };

export function useCharacterTemplateDialog(opts: {
  open: boolean;
  templateSetId: string;
  characterId: string | null;
  onSaved?: (characterId: string) => void;
}) {
  const kind: EntityKind = 'character';

  return useTemplateObjectDialog<
    PlayerCharacterOut,
    CharacterUpsertPayload,
    CharacterLookups,
    CharacterUpsertPayload,
    CharacterAssets
  >({
    open: opts.open,
    templateSetId: opts.templateSetId,
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

    loadLookups: async (api: RuleTemplatesApiService) => {
      const items = await api.getItemTemplates({ skip: 0, limit: 1000 });
      return { items, locations: [] as any };
    },

    loadFull: (api: RuleTemplatesApiService, id: string) => api.getCharacterTemplate(id),

    init: (full, lookups) => {
      const ownedItems = (full as any)?.owned_items ?? [];

      return {
        form: {
          force: false,
          id: (full as any)?.id ?? null,
          name: (full as any)?.name ?? '',
          short_desc: (full as any)?.short_desc ?? (full as any)?.shortdesc ?? null,
          story: (full as any)?.story ?? null,
          location_id: (full as any)?.location_id ?? (full as any)?.locationid ?? null,
          icon_url: (full as any)?.icon_url ?? (full as any)?.iconurl ?? null,
          img_url: (full as any)?.img_url ?? (full as any)?.imgurl ?? null,
          tags: (full as any)?.tags || [],
          data: (full as any)?.data ?? {},
          owned_items: ownedItems,
          take_from_other_owner_ids: [],
        } as any,
        assets: { iconFile: null, imgFile: null },
      };
    },

    buildPayload: (form: any, force: boolean, _assets: CharacterAssets) => {
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

    create: (api: RuleTemplatesApiService, payload: CharacterUpsertPayload, assets: CharacterAssets) =>
      api.createCharacterTemplate(payload as any, {
        iconFile: assets.iconFile ?? null,
        imgFile: assets.imgFile ?? null,
      }),

    update: (api: RuleTemplatesApiService, id: string, payload: CharacterUpsertPayload, assets: CharacterAssets) =>
      api.updateCharacterTemplate(id, payload as any, {
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
      validate: async (api: RuleTemplatesApiService, form: CharacterUpsertPayload): Promise<ValidateResult> => {
        const payload = { ...form, force: false } as any;
        const res: CharacterUpsertResult = await api.validateCharacterTemplate(payload);

        return {
          ok: !!(res as any)?.ok,
          issues: ((res as any)?.issues ?? []) as any,
          data: (res as any)?.data,
        };
      },
    },
  });
}
