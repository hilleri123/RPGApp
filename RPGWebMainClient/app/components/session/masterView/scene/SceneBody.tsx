'use client';

import type { Scene } from "@/app/services/types/session";

import Panel from "./Panel";
import SceneAllCharactersPanel from "./SceneAllCharactersPanel";
import ScenePublicPanel from "./ScenePublicPanel";
import ScenePrivatePanel from "./ScenePrivatePanel";
import SceneActionsPanel from "./SceneActionsPanel";
import { SessionEntityDialogs } from "@/app/components/session/common/SessionEntityDialogs";
import { useSessionEntityDialogs } from "@/app/services/hooks/session/useSessionEntityDialogs";
import { useMemo } from "react";
import { useSessionWebSocket } from "@/app/services/hooks/useSessionWebSocket";
import { useParams } from "next/navigation";
import SceneRulesPanel from "./SceneRulesPanel";
import SceneTimePanel from "./SceneTimePanel";

export default function SceneBody({
  sceneId,
}: {
  sceneId: string | null;
}) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const { scenes, timeline } = useSessionWebSocket(sessionId);
  const entityDialogs = useSessionEntityDialogs();

  const scene = useMemo(() => scenes?.find((s: any) => String(s.id) === String(sceneId)) ?? null, [scenes, sceneId]);

  if (!scene) {
    return (
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="text-sm text-gray-400">Сцена не выбрана.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="grid grid-cols-1 gap-4 min-h-0">
        <SceneAllCharactersPanel scene={scene} entityDialogs={entityDialogs} />

        <SceneTimePanel scene={scene} timeline={timeline} />

        <SceneRulesPanel scene={scene} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0 items-start">
          <ScenePublicPanel
            scene={scene}
            onEditItem={entityDialogs.editItem}
            onViewItem={entityDialogs.viewItem}
            onEditNpc={entityDialogs.editNpc}
            onViewNpc={entityDialogs.viewNpc}
            onEditObstacle={entityDialogs.editObstacle}
            onViewObstacle={entityDialogs.viewObstacle}
          />

          <ScenePrivatePanel
            scene={scene}
            onEditItem={entityDialogs.editItem}
            onViewItem={entityDialogs.viewItem}
            onEditNpc={entityDialogs.editNpc}
            onViewNpc={entityDialogs.viewNpc}
            onEditObstacle={entityDialogs.editObstacle}
            onViewObstacle={entityDialogs.viewObstacle}
          />
        </div>

        <SceneActionsPanel />
      </div>

      <SessionEntityDialogs {...entityDialogs} />
    </div>
  );
}
