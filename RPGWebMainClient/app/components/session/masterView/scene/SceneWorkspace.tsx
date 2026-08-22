'use client';

import { useCallback, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";

import { useSessionWebSocket } from "@/app/services/hooks/useSessionWebSocket";
import type { Scene } from "@/app/services/types/session";
import { useMasterUiStore } from '@/app/services/stores/masterUi';

import SceneHeader from "./SceneHeader";
import SceneBody from "./SceneBody";

export default function SceneWorkspace({
  currentLocationId,
  onSceneLocationChange,
}: {
  currentLocationId: string | null;
  onSceneLocationChange?: (locationId: string | null) => void;
}) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const { scenes, addScene } = useSessionWebSocket(sessionId);

  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);
  const setCurrentSceneId = useMasterUiStore((s) => s.setCurrentSceneId);

  useEffect(() => {
    if (!scenes || scenes.length === 0) {
      if (currentSceneId) setCurrentSceneId(null);
      return;
    }
    if (!currentSceneId || !scenes.some((s: Scene) => String(s.id) === String(currentSceneId))) {
      setCurrentSceneId(String(scenes[0].id));
    }
  }, [scenes, currentSceneId, setCurrentSceneId]);

  const currentScene: Scene | null = useMemo(() => {
    if (!currentSceneId) return null;
    return (scenes?.find((s: Scene) => String(s.id) === String(currentSceneId)) ?? null) as Scene | null;
  }, [scenes, currentSceneId]);

  useEffect(() => {
    if (!onSceneLocationChange) return;

    const locId = currentScene?.location?.id ?? null;
    onSceneLocationChange(locId ? String(locId) : null);
  }, [currentSceneId, currentScene?.location?.id, onSceneLocationChange]);

  const onAddScene = useCallback(() => {
    if (!currentLocationId) return;
    if (typeof addScene === "function") addScene(currentLocationId);
  }, [addScene, currentLocationId]);

  const goPrev = useCallback(() => {
    if (!scenes || scenes.length === 0 || !currentSceneId) return;
    const idx = scenes.findIndex((s: any) => String(s.id) === String(currentSceneId));
    if (idx <= 0) return;
    setCurrentSceneId(String(scenes[idx - 1].id));
  }, [scenes, currentSceneId, setCurrentSceneId]);

  const goNext = useCallback(() => {
    if (!scenes || scenes.length === 0 || !currentSceneId) return;
    const idx = scenes.findIndex((s: any) => String(s.id) === String(currentSceneId));
    if (idx < 0 || idx >= scenes.length - 1) return;
    setCurrentSceneId(String(scenes[idx + 1].id));
  }, [scenes, currentSceneId, setCurrentSceneId]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      <SceneHeader
        currentSceneId={currentSceneId}
        onSelectSceneId={(id) => setCurrentSceneId(id)}
        onPrev={goPrev}
        onNext={goNext}
        onAddScene={onAddScene}
        canAddScene={!!currentLocationId}
      />

      <SceneBody sceneId={currentSceneId} />
    </div>
  );
}
