'use client';

import { useScenarioObjectDialog } from '../useScenarioObjectDialog';

import type {
  LocationOut,
  LocationUpsertPayload,
  LocationList,
  NPCList,
  GameItemList,
  SceneExposureOut,
  MapObjectPolygonCreate,
  EntityKind,
  SceneExposure,
  SubLocationRef,
} from '@/app/services/types2';
import type { AudioTrack } from '@/app/services/types/audio';

import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import {
  normalizeExposureFromFull,
  buildExposuresPayload,
} from './sceneExposure';
import { audioApiService } from '@/app/services/api/audio';
import { kindOfTags } from '@/app/lib/locationKinds';
import {
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
  normalizeLegacyCanvasForm,
} from '@/app/components/common/map/mapCanvasUtils';

const LOCATION_EDITOR_CONFIG_KINDS: EntityKind[] = ['location', 'obstacle'];

type LocationLookups = {
  locations: LocationList[];
  npcs: NPCList[];
  items: GameItemList[];
  template_npcs: NPCList[];
  template_items: GameItemList[];
  audio_tracks: AudioTrack[];               // ← добавлено
};

type LocationAssets = {
  iconFile: File | null;
  mapFile: File | null;
};

function stripTmpId(id: unknown): string | undefined {
  if (typeof id !== 'string') return id as any;
  return id.startsWith('tmp_') ? undefined : id;
}

// ---------------------------------------------------------------------------

export function useLocationDialog(opts: {
  open: boolean;
  scenarioId: string;
  locationId: string | null;
  onSaved?: (id: string) => void;
}) {
  return useScenarioObjectDialog<
    LocationOut,
    LocationUpsertPayload,
    LocationLookups,
    LocationUpsertPayload,
    LocationAssets
  >({
    open: opts.open,
    scenarioId: opts.scenarioId,
    objectId: opts.locationId,
    onSaved: opts.onSaved,

    loadFull: (api: ScenarioScopedApiService, id: string) => api.getLocation(id),

    loadLookups: async (api: ScenarioScopedApiService) => {
      const [locations, npcs, items, template_npcs, template_items, audio_tracks] =
        await Promise.all([
          api.getLocations({ skip: 0, limit: 1000 }),
          api.getNpcs({ skip: 0, limit: 1000 }),
          api.getItemsWithOwner({ skip: 0, limit: 1000 }),
          api.getTemplateNpcs({ skip: 0, limit: 1000 }),
          api.getTemplateItemsWithOwner({ skip: 0, limit: 1000 }),
          audioApiService.getTracks({ offset: 0, limit: 1000 }),  // ← добавлено
        ]);
      return { locations, npcs, items, template_npcs, template_items, audio_tracks };
    },

    init: (full, lookups) => {
      const normalized = normalizeLegacyCanvasForm({
        map_url: full?.map_url ?? null,
        map_width: (full as any)?.map_width ?? null,
        map_height: (full as any)?.map_height ?? null,
        excalidraw_map_json: full?.excalidraw_map_json ?? null,
        map_objects: ((full as any)?.map_objects ?? []) as MapObjectPolygonCreate[],
      });
      return {
        form: {
          force: false,
          name: full?.name ?? '',
          description_for_master: full?.description_for_master ?? '',
          description_for_players: full?.description_for_players ?? '',
          parent_location_id: full?.parent_location_id ?? null,
          icon_url: full?.icon_url ?? null,
          map_url: full?.map_url ?? null,
          map_width: normalized.map_width,
          map_height: normalized.map_height,
          excalidraw_map_json: normalized.excalidraw_map_json,
          tags: full?.tags || [],
          data: (full as any)?.data ?? {},
          map_objects: normalized.map_objects as MapObjectPolygonCreate[],
          sublocations: (lookups?.locations ?? [])
            .filter((l: LocationList) => String(l.parent_location_id) === String(full?.id ?? ''))
            .map((l: LocationList) => ({ id: l.id, name: l.name, kind: kindOfTags(l.tags)?.id ?? null })),
          scene_exposures: ((full as any)?.scene_exposures ?? []).map(
            normalizeExposureFromFull,
          ) as SceneExposureOut[],
        },
        assets: { iconFile: null, mapFile: null },
      };
    },

    empty: () => ({
      form: {
        force: false,
        name: '',
        description_for_master: '',
        description_for_players: '',
        parent_location_id: null,
        is_start: false,
        icon_url: null,
        map_url: null,
        map_width: DEFAULT_MAP_WIDTH,
        map_height: DEFAULT_MAP_HEIGHT,
        excalidraw_map_json: null,
        tags: [],
        data: {},
        map_objects: [],
        sublocations: [],
        scene_exposures: [],
      },
      assets: { iconFile: null, mapFile: null },
    }),

    buildPayload: (form, force) => {
      const mapObjects = (form.map_objects ?? []).map((p: any) => ({
        ...p,
        id: stripTmpId(p?.id),
        source_location_id: p?.source_location_id ?? (opts.locationId ?? undefined),
      })) as any as MapObjectPolygonCreate[];

      return {
        ...form,
        force,
        map_objects: mapObjects,
        sublocations: (form.sublocations ?? [])
          .filter((s: SubLocationRef) => !s._deleted)
          .map(({ _new, _deleted, ...s }: any) => s),
        scene_exposures: buildExposuresPayload(form.scene_exposures ?? []),  // ← используем общую утилиту
      };
    },

    create: (api, payload, assets) =>
      api.createLocation(payload as any, {
        iconFile: assets.iconFile ?? null,
        mapFile: assets.mapFile ?? null,
      }),

    update: (api, id, payload, assets) =>
      api.updateLocation(id, payload as any, {
        iconFile: assets.iconFile ?? null,
        mapFile: assets.mapFile ?? null,
      }),

    rules: {
      loadConfigFor: LOCATION_EDITOR_CONFIG_KINDS,
      context: {},
      validate: async (api, form) => {
        const res = await api.validateLocation({ ...(form as any), force: false });
        return { ok: !!res.ok, issues: (res.issues ?? []) as any, data: (res as any).data };
      },
    },
  });
}