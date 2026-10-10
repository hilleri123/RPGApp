import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Location } from "@/app/services/types2";
import { ExposureCard } from "./ExposureCard";

interface LocationExposuresPanelProps {
  location: Location | null;
  locations?: Location[];
  scene_id: string | null;
  applySceneExposure: (
    sceneId: string,
    expositionId: string,
    from_location_id?: string,
    from_story_beat?: string,
  ) => void;
}

/** Родители от ближайшего к корню. Цикл в parent_location_id обход не зацикливает. */
function ancestorLocations(location: Location, all: Location[]): Location[] {
  const byId = new Map(all.map((l) => [String(l.id), l]));
  const out: Location[] = [];
  const seen = new Set<string>([String(location.id)]);
  let pid = location.parent_location_id ? String(location.parent_location_id) : "";
  while (pid && !seen.has(pid)) {
    seen.add(pid);
    const parent = byId.get(pid);
    if (!parent) break;
    out.push(parent);
    pid = parent.parent_location_id ? String(parent.parent_location_id) : "";
  }
  return out;
}

export function LocationExposuresPanel({
  location,
  locations = [],
  scene_id,
  applySceneExposure,
}: LocationExposuresPanelProps) {
  const [showParents, setShowParents] = useState(false);

  const parents = useMemo(
    () => (location ? ancestorLocations(location, locations) : []),
    [location, locations],
  );
  const parentsWithExposures = useMemo(
    () => parents.filter((p) => (p.scene_exposures ?? []).length > 0),
    [parents],
  );

  if (!location || !scene_id) return null;

  const own = location.scene_exposures ?? [];
  if (!own.length && !parentsWithExposures.length) return null;

  return (
    <div className="border-t border-gray-800 bg-gray-950/60">
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-300 truncate">
          Экспозиции локации:{" "}
          <span className="font-semibold">{location.name}</span>
        </div>
        {parentsWithExposures.length > 0 ? (
          <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-300 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-600 bg-gray-900"
              checked={showParents}
              onChange={(e) => setShowParents(e.target.checked)}
            />
            Родительские
          </label>
        ) : null}
      </div>
      <ScrollArea className="max-h-72">
        <div className="px-3 pb-2 flex flex-col gap-2">
          {own.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {own.map((ex: any) => (
                <ExposureCard
                  key={ex.id}
                  ex={ex}
                  scene_id={scene_id}
                  location_id={location.id}
                  applySceneExposure={applySceneExposure}
                />
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-gray-500">У этой локации экспозиций нет.</div>
          )}

          {showParents
            ? parentsWithExposures.map((parent) => (
                <div key={String(parent.id)} className="flex flex-col gap-1">
                  <div className="text-[10px] uppercase tracking-wide text-amber-200/80">
                    из: {parent.name}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(parent.scene_exposures ?? []).map((ex: any) => (
                      <ExposureCard
                        key={`${parent.id}:${ex.id}`}
                        ex={ex}
                        scene_id={scene_id}
                        location_id={String(parent.id)}
                        sourceLabel={parent.name}
                        applySceneExposure={applySceneExposure}
                      />
                    ))}
                  </div>
                </div>
              ))
            : null}
        </div>
      </ScrollArea>
    </div>
  );
}
