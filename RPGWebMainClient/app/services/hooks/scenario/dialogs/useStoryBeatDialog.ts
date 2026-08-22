// hooks/scenario/dialogs/useStoryBeatDialog.ts
'use client';

import { useScenarioObjectDialog } from '../useScenarioObjectDialog';

import type {
  StoryBeatOut,
  StoryBeatUpsertPayload,
  LocationList,
  NPCList,
  GameItemList,
  EntityKind,
} from '@/app/services/types2';

import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import {
  normalizeExposureFromFull,
  buildExposuresPayload,
} from './sceneExposure';
import { audioApiService } from '@/app/services/api/audio';

const STORY_BEAT_EDITOR_CONFIG_KINDS: EntityKind[] = ['obstacle'];

type StoryBeatLookups = {
  locations: LocationList[];
  npcs: NPCList[];
  items: GameItemList[];
  template_npcs: NPCList[];
  template_items: GameItemList[];
};

type StoryBeatAssets = { imgFile: File | null };

// ---------------------------------------------------------------------------

export function useStoryBeatDialog(opts: {
  open: boolean;
  scenarioId: string;
  storyBeatId: string | null;
  onSaved?: (id: string) => void;
}) {
  return useScenarioObjectDialog<
    StoryBeatOut,
    StoryBeatUpsertPayload,
    StoryBeatLookups,
    StoryBeatUpsertPayload,
    StoryBeatAssets
  >({
    open: opts.open,
    scenarioId: opts.scenarioId,
    objectId: opts.storyBeatId,
    onSaved: opts.onSaved,

    loadFull: (api: ScenarioScopedApiService, id: string) => api.getStoryBeat(id),

    loadLookups: async (api: ScenarioScopedApiService) => {
      const [locations, npcs, items, template_npcs, template_items, audio_tracks] = await Promise.all([
        api.getLocations({ skip: 0, limit: 1000 }),
        api.getNpcs({ skip: 0, limit: 1000 }),
        api.getItemsWithOwner({ skip: 0, limit: 1000 }),
        api.getTemplateNpcs({ skip: 0, limit: 1000 }),
        api.getTemplateItemsWithOwner({ skip: 0, limit: 1000 }),
        audioApiService.getTracks({ offset: 0, limit: 1000 }),
      ]);
      return { locations, npcs, items, template_npcs, template_items, audio_tracks };
    },

    init: (full) => ({
      form: {
        force: false,
        name: full?.name ?? '',
        order_num: full?.order_num ?? 0,
        text_for_master: full?.text_for_master ?? null,
        text_for_players: full?.text_for_players ?? null,
        img_url: full?.img_url ?? null,
        parent_story_beat_id: full?.parent_story_beat_id ?? null,
        location_ids: full?.location_ids ?? [],
        npc_ids: full?.npc_ids ?? [],
        tags: full?.tags ?? [],
        data: (full as any)?.data ?? {},
        scene_exposures: ((full as any)?.scene_exposures ?? []).map(normalizeExposureFromFull),
      },
      assets: { imgFile: null },
    }),

    empty: () => ({
      form: {
        force: false,
        name: '',
        order_num: 0,
        text_for_master: null,
        text_for_players: null,
        img_url: null,
        parent_story_beat_id: null,
        location_ids: [],
        npc_ids: [],
        tags: [],
        data: {},
        scene_exposures: [],
      },
      assets: { imgFile: null },
    }),

    // вся логика сборки payload — в sceneExposure.ts
    buildPayload: (form, force) => ({
      ...form,
      force,
      scene_exposures: buildExposuresPayload(form.scene_exposures ?? []),
    }),

    create: (api, payload, assets) =>
      api.createStoryBeat(payload as any, { imgFile: assets.imgFile ?? null }),

    update: (api, id, payload, assets) =>
      api.updateStoryBeat(id, payload as any, { imgFile: assets.imgFile ?? null }),

    rules: {
      loadConfigFor: STORY_BEAT_EDITOR_CONFIG_KINDS,
      context: {},
      validate: async (api, form) => {
        const res = await api.validateStoryBeat({ ...(form as any), force: false });
        return { ok: !!res.ok, issues: (res.issues ?? []) as any, data: (res as any).data };
      },
    },
  });
}