import type { UUID } from './common';
import type { EntityData, UpsertResult, WithLineage } from './entities';
import { MapObjectPolygon, MapObjectPolygonCreate } from './map';
import { SceneExposure, SceneExposureBase, SceneExposureOut } from './scene_exposure';


import type { SceneExposurePreview } from './scene_exposure';

// --------- location models ---------

// соответствует LocationBase (бэк)
export interface LocationBase {
  name: string;
  description_for_master: string;
  description_for_players: string;

  parent_location_id?: UUID | null;

  icon_url?: string | null;
  map_url?: string | null;
  /** White-canvas size when no map_url; mirrors image natural size when map_url is set. */
  map_width?: number | null;
  map_height?: number | null;
  excalidraw_map_json?: any;
  tags?: string[];
}

// соответствует LocationOut (бэк)
export interface LocationOut extends LocationBase, WithLineage {
  id: UUID;
  scenario_id: UUID;

  map_objects: MapObjectPolygon[];
  scene_exposures: SceneExposureOut[];
}

// соответствует Location (бэк) = Out + data
export interface Location extends LocationOut {
  data: EntityData;
}

// соответствует LocationList (бэк)
export interface LocationList extends LocationBase, WithLineage {
  id: UUID;
  parent_location_name?: string;
  scene_exposures?: SceneExposurePreview[];
}

// --------- upsert ---------


export type SubLocationRef = {
  id?: string | null;   // null/undefined = новая, иначе существующая
  name: string;
  /** id вида местности (см. lib/locationKinds.ts); undefined — не менять, null — снять. */
  kind?: string | null;
  _deleted?: boolean;   // мягкое удаление — показываем серым, из payload фильтруем
  _new?: boolean; 
};


export interface LocationUpsertPayload extends LocationBase {
  force?: boolean; // default false
  data: EntityData;

  map_objects?: MapObjectPolygonCreate[];   // default []
  sublocations?: SubLocationRef[];
  scene_exposures?: SceneExposure[];
}

export interface LocationUpsertResult extends UpsertResult {
  location: LocationOut | null;
}


export type SubLocationFromMapItem = {
  name: string;
  polygon: { x: number; y: number }[];
  map_key?: string | null;
  color?: string;
  description_for_master?: string;
  description_for_players?: string;
};
