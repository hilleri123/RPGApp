import type { UUID } from "./common";

export interface MapObjectPolygonPoint {
  x: number;
  y: number;
}

export interface MapObjectPolygonBase {
  name: string;
  source_location_id: UUID;
  target_location_id: UUID | null;

  internal_id?: string;

  is_shown: boolean;
  is_line: boolean;
  is_filled: boolean;

  alpha: number;
  color: string;

  polygon_list: MapObjectPolygonPoint[];

  icon?: string;
  icon_url?: string | null;
}

export interface MapObjectPolygonCreate extends MapObjectPolygonBase {
  // на create из фронта можно НЕ слать id
}

export interface MapObjectPolygon extends MapObjectPolygonBase {
  id: UUID;
}

export interface MapObjectPolygonUpdate extends Partial<MapObjectPolygonBase> {}
