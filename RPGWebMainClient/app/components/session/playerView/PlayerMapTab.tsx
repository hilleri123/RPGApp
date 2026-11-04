'use client';

import { useMemo } from "react";
import { usePlayerSessionWebSocket } from "@/app/services/hooks/usePlayerSessionWebSocket";
import { SceneCanvasView, assignedCanvas, canvasMapLocation } from "../masterView/scene/SceneCanvasView";

interface PlayerMapTabProps {
  sessionId: string;
  compact?: boolean;
}

export default function PlayerMapTab({ sessionId }: PlayerMapTabProps) {
  const { scene, locations, mapOverlays, selfPlayer, characters, npcs, items } = usePlayerSessionWebSocket(sessionId);

  const canvas = useMemo(
    () => assignedCanvas(scene, selfPlayer?.user?.id),
    [scene, selfPlayer?.user?.id],
  );

  const location = canvasMapLocation(canvas, locations);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entity of [...(characters ?? []), ...(npcs ?? []), ...(items ?? []), ...(scene?.characters ?? [])]) {
      if ((entity as any)?.id) map[String((entity as any).id)] = (entity as any).name ?? '';
    }
    return map;
  }, [characters, npcs, items, scene?.characters]);

  if (!scene || !canvas || !location) {
    return (
      <div className="text-xs text-gray-400 p-2">
        Карта недоступна — персонаж не на сцене.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0">
      <SceneCanvasView
        location={location}
        canvas={canvas}
        overlays={mapOverlays ?? []}
        names={names}
      />
    </div>
  );
}
