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
import { isEntityDataRevealed } from '@/app/services/types/playerSeen';
import type { EntityDialogMeta } from '@/app/services/hooks/session/useSessionEntityDialogs';

export default function ScenePublicPanel({
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
  onViewNpc?: (npc: any, meta?: EntityDialogMeta) => void;
  onEditItem?: (item: any) => void;
  onViewItem?: (item: any, meta?: EntityDialogMeta) => void;
  onEditObstacle?: (obstacle: any) => void;
  onViewObstacle?: (obstacle: any) => void;
}) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const {
    isMaster,
    makeElementPublic,
    moveOutScene,
    presentEntity,
    grantEntityDataAccess,
    revokeEntityDataAccess,
    dataRevealedEntities,
  } = useSessionWebSocket(sessionId) as any;

  const publicNpcs: any[] = scene?.public?.npcs ?? [];
  const publicItems: any[] = scene?.public?.items ?? [];
  const publicObstacles: any[] = scene?.public?.obstacles ?? [];
  const isEmpty =
    publicNpcs.length === 0 &&
    publicItems.length === 0 &&
    publicObstacles.length === 0;

  const dataAccessMeta = useCallback(
    (entityType: 'npc' | 'game_item', entity: { id: string; copied_from?: string | null }): EntityDialogMeta | undefined => {
      if (!isMaster) return undefined;
      const revealed = isEntityDataRevealed(dataRevealedEntities, entityType, entity);
      return {
        sceneId: String(scene.id),
        ...(revealed
          ? {
              canCloseData: true,
              onCloseData: () => revokeEntityDataAccess(scene.id, entityType, entity.id),
            }
          : {
              canOpenData: true,
              onOpenData: () => grantEntityDataAccess(scene.id, entityType, entity.id),
            }),
      };
    },
    [dataRevealedEntities, grantEntityDataAccess, revokeEntityDataAccess, isMaster, scene.id],
  );

  const dataAccessContextItem = useCallback(
    (entityType: 'npc' | 'game_item', entity: { id: string; copied_from?: string | null }) => {
      const meta = dataAccessMeta(entityType, entity);
      if (!meta) return null;
      if (meta.canCloseData && meta.onCloseData) {
        return { onClick: meta.onCloseData, ...ContextActions.closeData };
      }
      if (meta.canOpenData && meta.onOpenData) {
        return { onClick: meta.onOpenData, ...ContextActions.openData };
      }
      return null;
    },
    [dataAccessMeta],
  );

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
        makeElementPublic(scene.id, true, npc.id, undefined, undefined);
        return;
      }

      const item = parseGameItemFromDragEvent(e);
      if (item) {
        makeElementPublic(scene.id, true, undefined, item.id, undefined);
        return;
      }

      const obstacle = parseObstacleFromDragEvent(e);
      if (obstacle) {
        makeElementPublic(scene.id, true, undefined, undefined, obstacle.id);
        return;
      }
    },
    [isMaster, makeElementPublic, scene.id],
  );

  return (
    <Panel title="Публичные элементы">
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

        {publicNpcs.map((npc) => {
          const npcMeta = dataAccessMeta('npc', npc);
          const dataRevealed = isEntityDataRevealed(dataRevealedEntities, 'npc', npc);
          const dataAccessItem = dataAccessContextItem('npc', npc);

          return (
            <NPCDraggableSquare
              key={npc.id}
              npc={npc}
              isMaster={isMaster}
              dataRevealed={dataRevealed}
              onInfo={onViewNpc ? () => onViewNpc(npc, npcMeta) : undefined}
              contextItems={[
                { onClick: () => onEditNpc?.(npc), ...ContextActions.edit },
                ...(dataAccessItem ? [dataAccessItem] : []),
                {
                  onClick: () => presentEntity(scene.id, 'npc', npc.id),
                  ...ContextActions.presentToScene,
                },
                {
                  onClick: () =>
                    makeElementPublic(
                      scene.id,
                      false,
                      npc.id,
                      undefined,
                      undefined,
                    ),
                  ...ContextActions.makePrivate,
                },
                {
                  onClick: () =>
                    moveOutScene(scene.id, npc.id, undefined, undefined),
                  ...ContextActions.removeFromScene,
                },
              ]}
            />
          );
        })}

        {publicItems.map((item) => {
          const itemMeta = dataAccessMeta('game_item', item);
          const dataRevealed = isEntityDataRevealed(dataRevealedEntities, 'game_item', item);
          const dataAccessItem = dataAccessContextItem('game_item', item);

          return (
            <ItemDraggableSquare
              key={item.id}
              item={item}
              isMaster={isMaster}
              dataRevealed={dataRevealed}
              onInfo={onViewItem ? () => onViewItem(item, itemMeta) : undefined}
              contextItems={[
                { onClick: () => onEditItem?.(item), ...ContextActions.edit },
                ...(dataAccessItem ? [dataAccessItem] : []),
                {
                  onClick: () => presentEntity(scene.id, 'game_item', item.id),
                  ...ContextActions.presentToScene,
                },
                {
                  onClick: () =>
                    makeElementPublic(
                      scene.id,
                      false,
                      undefined,
                      item.id,
                      undefined,
                    ),
                  ...ContextActions.makePrivate,
                },
                {
                  onClick: () =>
                    moveOutScene(scene.id, undefined, item.id, undefined),
                  ...ContextActions.removeFromScene,
                },
              ]}
            />
          );
        })}

        {publicObstacles.map((obstacle) => (
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
                    false,
                    undefined,
                    undefined,
                    obstacle.id,
                  ),
                ...ContextActions.makePrivate,
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
