import type { Location, MapObjectPolygon } from '@/app/services/types2';

/** Полигоны холста: у прямых подлокаций, плюс старые на родителе, если они указывают на подлокацию. */
export function polygonsOnLocationMap(location: Location, all: Location[] | null | undefined): MapObjectPolygon[] {
  const list = all ?? [];
  const here = String(location.id);
  const fromChildren = list
    .filter((loc) => String(loc.parent_location_id ?? '') === here)
    .flatMap((loc) => loc.map_objects ?? []);
  const seen = new Set(fromChildren.map((poly) => String(poly.id)));
  const legacy = (location.map_objects ?? []).filter(
    (poly) => poly.target_location_id && !seen.has(String(poly.id)),
  );
  return [...fromChildren, ...legacy];
}

export function locationWithDisplayPolygons(
  location: Location,
  all: Location[] | null | undefined,
): Location {
  return { ...location, map_objects: polygonsOnLocationMap(location, all) };
}
