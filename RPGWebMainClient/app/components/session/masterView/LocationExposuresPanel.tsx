import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { Location } from "@/app/services/types2";
import type { Scene } from "@/app/services/types/session";
import { ExposureCard } from "./ExposureCard";

interface LocationExposuresPanelProps {
  location: Location | null;
  scene_id: string | null;
  applySceneExposure: (
    sceneId: string,
    expositionId: string,
    from_location_id?: string,
    from_story_beat?: string,
  ) => void;
}

export function LocationExposuresPanel({
  location,
  scene_id,
  applySceneExposure,
}: LocationExposuresPanelProps) {
  if (!location || !scene_id) return null;

  const exposures = location.scene_exposures ?? [];
  if (!exposures.length) return null;

  return (
    <div className="border-t border-gray-800 bg-gray-950/60">
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-300">
          Экспозиции локации:{" "}
          <span className="font-semibold">{location.name}</span>
        </div>
      </div>
      <ScrollArea className="max-h-52">
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {exposures.map((ex: any) => (
            <ExposureCard
              key={ex.id}
              ex={ex}
              scene_id={scene_id}
              location_id={location.id}
              applySceneExposure={applySceneExposure}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
