'use client';

import { useParams } from "next/navigation";
import { useSessionWebSocket } from "@/app/services/hooks/useSessionWebSocket";
import { useSessionEntityDialog } from "@/app/services/hooks/session/useSessionEntityDialog";

export function useObstacleDialogSession(opts: { 
  open: boolean; 
  editingObstacle?: any | null,
  onSaved?: () => void 
}) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const { createObstacle, updateObstacle } = useSessionWebSocket(sessionId);

  return useSessionEntityDialog({
    open: opts.open,
    entity: "obstacle",
    entityId: (opts.editingObstacle?.id ?? null) as string | null,
    initialForm: {
      id: null as any,
      name: "",
      description_for_master: null,
      description_for_players: null,
      tags: [],
      data: {},
    } as any,

    rulesContext: (sceneId) => ({ scene_id: sceneId }),

    loadImpl: async (_sceneId, entityId) => {
      const obstacle = opts.editingObstacle;
      if (!obstacle) return null;
      if (String(obstacle.id ?? '') !== String(entityId)) return null;
      return obstacle;
    },

    saveImpl: (sceneId, payload) => {
      if (opts.editingObstacle?.id) return updateObstacle(sceneId, payload as any);
      return createObstacle(sceneId, payload as any);
    },

    disableSave: (form, sceneId) => !sceneId || !String((form as any)?.name ?? "").trim(),
    onSaved: opts.onSaved,
  });
}
