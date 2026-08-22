'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import CharacterSessionEditDialog from '@/app/components/session/masterView/control/dialogs/CharacterSessionEditDialog';
import ItemSessionEditDialog from '@/app/components/session/masterView/control/dialogs/ItemSessionEditDialog';
import NpcSessionEditDialog from '@/app/components/session/masterView/control/dialogs/NpcSessionEditDialog';
import ObstacleSessionEditDialog from '@/app/components/session/masterView/control/dialogs/ObstacleSessionEditDialog';
import { SessionEntityViewDialog } from '@/app/components/session/common/SessionEntityViewDialog';
import type { useSessionEntityDialogs, EntityDialogMeta } from '@/app/services/hooks/session/useSessionEntityDialogs';
import type { PlayerSeenEntry } from '@/app/services/types/playerSeen';
import { isEntityDataRevealed, resolveSeenDataAccess } from '@/app/services/types/playerSeen';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import type { GameItem, NPC, PlayerCharacter } from '@/app/services/types2';
import type { Scene } from '@/app/services/types/session';

type DialogState = ReturnType<typeof useSessionEntityDialogs>;

type ViewKind = 'npc' | 'game_item' | 'player_character';

function resolveSessionEntity(
  kind: ViewKind,
  entity: { id: string },
  sources: {
    npcs?: NPC[];
    items?: GameItem[];
    characters?: PlayerCharacter[];
    scenes?: Scene[];
  },
): NPC | GameItem | PlayerCharacter {
  const id = String(entity.id);

  if (kind === 'npc') {
    const fromList = sources.npcs?.find((n) => String(n.id) === id);
    if (fromList) return fromList;
    for (const scene of sources.scenes ?? []) {
      const fromScene = [...(scene.public?.npcs ?? []), ...(scene.private?.npcs ?? [])].find(
        (n) => String(n.id) === id,
      );
      if (fromScene) return fromScene;
    }
    return entity as NPC;
  }

  if (kind === 'game_item') {
    const fromList = sources.items?.find((i) => String(i.id) === id);
    if (fromList) return fromList;
    for (const scene of sources.scenes ?? []) {
      const fromScene = [...(scene.public?.items ?? []), ...(scene.private?.items ?? [])].find(
        (i) => String(i.id) === id,
      );
      if (fromScene) return fromScene;
    }
    return entity as GameItem;
  }

  const fromList = sources.characters?.find((c) => String(c.id) === id);
  if (fromList) return fromList;
  for (const scene of sources.scenes ?? []) {
    const fromScene = (scene.characters ?? []).find((c) => String(c.id) === id);
    if (fromScene) return fromScene;
  }
  return entity as PlayerCharacter;
}

export function SessionEntityDialogs({
  npcDlg,
  itemDlg,
  characterDlg,
  obstacleDlg,
  setNpcDlg,
  setItemDlg,
  setCharacterDlg,
  setObstacleDlg,
  playerSeen: playerSeenProp,
}: Pick<
  DialogState,
  | 'npcDlg'
  | 'itemDlg'
  | 'characterDlg'
  | 'obstacleDlg'
  | 'setNpcDlg'
  | 'setItemDlg'
  | 'setCharacterDlg'
  | 'setObstacleDlg'
> & {
  playerSeen?: PlayerSeenEntry[];
}) {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? '';
  const {
    pluginUI,
    session,
    npcs,
    items,
    characters,
    scenes,
    isMaster,
    playerSeen: playerSeenFromStore,
    dataRevealedEntities,
    grantEntityDataAccess,
    revokeEntityDataAccess,
  } = useSessionWebSocket(sessionId);

  const playerSeen = playerSeenProp ?? playerSeenFromStore ?? [];
  const scenarioId = session?.scenario_id ? String(session.scenario_id) : null;

  const entitySources = useMemo(
    () => ({ npcs, items, characters, scenes }),
    [npcs, items, characters, scenes],
  );

  const dataAccessFor = (
    entityType: string,
    entity: { id: string; copied_from?: string | null },
  ) => resolveSeenDataAccess(playerSeen, entityType, entity);

  const liveDataAccessMeta = (
    kind: ViewKind,
    entity: { id: string; copied_from?: string | null },
    meta?: EntityDialogMeta,
  ) => {
    if (!isMaster || !meta?.sceneId) return {};
    const entityType = kind === 'game_item' ? 'game_item' : kind;
    const revealed = isEntityDataRevealed(dataRevealedEntities, entityType, entity);
    if (revealed) {
      return {
        canCloseData: true,
        onCloseData: () => revokeEntityDataAccess(meta.sceneId!, entityType as any, entity.id),
      };
    }
    return {
      canOpenData: true,
      onOpenData: () => grantEntityDataAccess(meta.sceneId!, entityType as any, entity.id),
    };
  };

  const viewDialogProps = (
    kind: ViewKind,
    entity: { id: string; copied_from?: string | null },
    meta?: EntityDialogMeta,
  ) => ({
    pluginUI,
    scenarioId,
    sceneId: meta?.sceneId,
    ...liveDataAccessMeta(kind, entity, meta),
  });

  const npcEntity =
    npcDlg?.entity != null
      ? resolveSessionEntity('npc', npcDlg.entity, entitySources)
      : null;
  const itemEntity =
    itemDlg?.entity != null
      ? resolveSessionEntity('game_item', itemDlg.entity, entitySources)
      : null;
  const characterEntity =
    characterDlg?.entity != null
      ? resolveSessionEntity('player_character', characterDlg.entity, entitySources)
      : null;

  return (
    <>
      {npcDlg ? (
        npcDlg.readOnly && npcEntity ? (
          <SessionEntityViewDialog
            open
            onClose={() => setNpcDlg(null)}
            kind="npc"
            entity={npcEntity}
            dataAccess={dataAccessFor('npc', npcEntity)}
            {...viewDialogProps('npc', npcEntity, npcDlg.meta)}
          />
        ) : !npcDlg.readOnly ? (
          <NpcSessionEditDialog
            open
            onClose={() => setNpcDlg(null)}
            editingNpc={npcEntity}
            readOnly={false}
          />
        ) : null
      ) : null}
      {itemDlg ? (
        itemDlg.readOnly && itemEntity ? (
          <SessionEntityViewDialog
            open
            onClose={() => setItemDlg(null)}
            kind="game_item"
            entity={itemEntity}
            dataAccess={dataAccessFor('game_item', itemEntity)}
            {...viewDialogProps('game_item', itemEntity, itemDlg.meta)}
          />
        ) : !itemDlg.readOnly ? (
          <ItemSessionEditDialog
            open
            onClose={() => setItemDlg(null)}
            editingItem={itemEntity}
            readOnly={false}
          />
        ) : null
      ) : null}
      {characterDlg ? (
        characterDlg.readOnly && characterEntity ? (
          <SessionEntityViewDialog
            open
            onClose={() => setCharacterDlg(null)}
            kind="player_character"
            entity={characterEntity}
            dataAccess={dataAccessFor('player_character', characterEntity)}
            {...viewDialogProps('player_character', characterEntity, characterDlg.meta)}
          />
        ) : !characterDlg.readOnly ? (
          <CharacterSessionEditDialog
            open
            onClose={() => setCharacterDlg(null)}
            editingCharacter={characterEntity}
            readOnly={false}
          />
        ) : null
      ) : null}
      {obstacleDlg ? (
        <ObstacleSessionEditDialog
          open
          onClose={() => setObstacleDlg(null)}
          editingObstacle={obstacleDlg.entity}
          readOnly={obstacleDlg.readOnly}
        />
      ) : null}
    </>
  );
}
