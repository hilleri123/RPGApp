'use client';

import React, { useCallback } from 'react';
import { useParams } from 'next/navigation';
import type { Scene } from '@/app/services/types/session';
import Panel from './Panel';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import {
  ItemDraggableSquare,
  parseGameItemFromDragEvent,
} from '@/app/components/common/squares/ItemDraggableSquare';
import {
  NPCDraggableSquare,
  parseNPCFromDragEvent,
} from '@/app/components/common/squares/NPCDraggableSquare';
import {
  ObstacleDraggableSquare,
  parseObstacleFromDragEvent,
} from '@/app/components/common/squares/ObstacleDraggableSquare';
import { ContextActions } from '@/app/components/common/DraggableSquare';

export default function ScenePrivatePanel({
  scene,
  onEditNpc,
  onViewNpc,
  onEditItem,
  onViewItem,
  onEditObstacle,
  onViewObstacle,
}: {
  scene: Scene;
  onEditNpc?: (npc: any) => void;
  onViewNpc?: (npc: any) => void;
  onEditItem?: (item: any) => void;
  onViewItem?: (item: any) => void;
  onEditObstacle?: (obstacle: any) => void;
  onViewObstacle?: (obstacle: any) => void;
}) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const { isMaster, makeElementPublic, moveOutScene } =
    useSessionWebSocket(sessionId) as any;

  const privateNpcs: any[] = scene?.private?.npcs ?? [];
  const privateItems: any[] = scene?.private?.items ?? [];
  const privateObstacles: any[] = scene?.private?.obstacles ?? [];
  const isEmpty =
    privateNpcs.length === 0 &&
    privateItems.length === 0 &&
    privateObstacles.length === 0;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!isMaster) return;

      const npc = parseNPCFromDragEvent(e);
      if (npc) {
        makeElementPublic(scene.id, false, npc.id, undefined, undefined);
        return;
      }

      const item = parseGameItemFromDragEvent(e);
      if (item) {
        makeElementPublic(scene.id, false, undefined, item.id, undefined);
        return;
      }

      const obstacle = parseObstacleFromDragEvent(e);
      if (obstacle) {
        makeElementPublic(scene.id, false, undefined, undefined, obstacle.id);
        return;
      }
    },
    [isMaster, makeElementPublic, scene.id],
  );

  return (
    <Panel title="Приватные элементы">
      <div
        className="rounded border border-zinc-800/80 bg-zinc-950/20 px-3 py-2 min-h-[4.5rem] max-h-[13.5rem] flex flex-wrap items-start gap-2 overflow-y-auto"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isEmpty && (
          <div className="text-xs text-muted-foreground opacity-60 w-full text-center">
            Перетащи NPC, предмет или препятствие сюда
          </div>
        )}

        {privateNpcs.map((npc) => (
          <NPCDraggableSquare
            key={npc.id}
            npc={npc}
            isMaster={isMaster}
            onInfo={onViewNpc ? () => onViewNpc(npc) : undefined}
            contextItems={[
              { onClick: () => onEditNpc?.(npc), ...ContextActions.edit },
              {
                onClick: () =>
                  makeElementPublic(
                    scene.id,
                    true,
                    npc.id,
                    undefined,
                    undefined,
                  ),
                ...ContextActions.makePublic,
              },
              {
                onClick: () =>
                  moveOutScene(scene.id, npc.id, undefined, undefined),
                ...ContextActions.removeFromScene,
              },
            ]}
          />
        ))}

        {privateItems.map((item) => (
          <ItemDraggableSquare
            key={item.id}
            item={item}
            isMaster={isMaster}
            onInfo={onViewItem ? () => onViewItem(item) : undefined}
            contextItems={[
              { onClick: () => onEditItem?.(item), ...ContextActions.edit },
              {
                onClick: () =>
                  makeElementPublic(
                    scene.id,
                    true,
                    undefined,
                    item.id,
                    undefined,
                  ),
                ...ContextActions.makePublic,
              },
              {
                onClick: () =>
                  moveOutScene(scene.id, undefined, item.id, undefined),
                ...ContextActions.removeFromScene,
              },
            ]}
          />
        ))}

        {privateObstacles.map((obstacle) => (
          <ObstacleDraggableSquare
            key={obstacle.id}
            obstacle={obstacle}
            isMaster={isMaster}
            onInfo={onViewObstacle ? () => onViewObstacle(obstacle) : undefined}
            contextItems={[
              {
                onClick: () => onEditObstacle?.(obstacle),
                ...ContextActions.edit,
              },
              {
                onClick: () =>
                  makeElementPublic(
                    scene.id,
                    true,
                    undefined,
                    undefined,
                    obstacle.id,
                  ),
                ...ContextActions.makePublic,
              },
              {
                onClick: () =>
                  moveOutScene(scene.id, undefined, undefined, obstacle.id),
                ...ContextActions.removeFromScene,
              },
            ]}
          />
        ))}
      </div>
    </Panel>
  );
}
