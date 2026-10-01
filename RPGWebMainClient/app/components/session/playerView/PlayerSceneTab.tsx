'use client';

import React, { useMemo } from 'react';
import { usePlayerSessionWebSocket } from '@/app/services/hooks/usePlayerSessionWebSocket';
import { ContextActions } from '@/app/components/common/DraggableSquare';
import { SessionEntityDialogs } from '@/app/components/session/common/SessionEntityDialogs';
import { useSessionEntityDialogs } from '@/app/services/hooks/session/useSessionEntityDialogs';

import { ItemDraggableSquare } from '@/app/components/common/squares/ItemDraggableSquare';
import { NPCDraggableSquare } from '../../common/squares/NPCDraggableSquare';
import PlayerSceneActionsPanel from './PlayerSceneActionsPanel';
import { Player } from '@/app/services/types/lobby';
import { CharacterDraggableSquare } from '../../common/squares/CharacterDraggableSquare';
import { Clock } from 'lucide-react';
import { AudioPlayerPanel } from './AudioPlayerPanel';
import SceneMiniMap from '@/app/components/session/common/SceneMiniMap';

const playerCharacterId = (p: any) => String(p?.character_id ?? p?.characterid ?? '');
const charId = (c: any) => String(c?.id ?? '');

interface PlayerSceneTabProps {
  sessionId: string;
}

export default function PlayerSceneTab({ sessionId }: PlayerSceneTabProps) {
  const { scene, scenes, selfPlayer, session, audio_player, pluginUI, takeItem, playerSeen, locations, polygon_shown } =
    usePlayerSessionWebSocket(sessionId);
  const entityDialogs = useSessionEntityDialogs();

  const SceneDataView = pluginUI?.SceneDataView;
  const canRenderView = typeof SceneDataView === 'function';

  const players: Player[] = session?.players ?? [];

  const inThisScene = useMemo(() => {
    const idsFromArray = Array.isArray((scene as any)?.character_ids)
      ? (scene as any).character_ids
      : (scene as any)?.characters?.map((c: any) => c?.id) ?? [];
    return new Set((idsFromArray ?? []).map((x: any) => String(x)));
  }, [scene]);

  const charactersWithPlayer = useMemo(() => {
    const byId = new Map<string, any>();
    for (const s of scenes ?? []) {
      for (const character of (s as any).characters ?? []) {
        const id = charId(character);
        if (id && !byId.has(id)) byId.set(id, character);
      }
    }
    return Array.from(byId.values())
      .map((character: any) => {
        const player = players.find((p: any) => playerCharacterId(p) === charId(character));
        return player ? { character, player } : null;
      })
      .filter(Boolean) as Array<{ character: any; player: Player }>;
  }, [scenes, players]);

  const allScenesItemsAndNpcs = useMemo(() => {
    if (!scenes) return { items: [], npcs: [] };

    const allItems: Array<{ item: any; scene: any; isCurrent: boolean }> = [];
    const allNpcs: Array<{ npc: any; scene: any; isCurrent: boolean }> = [];

    for (const s of scenes) {
      const isCurrent = s.id === scene?.id;
      for (const item of (s.public?.items ?? [])) {
        allItems.push({ item, scene: s, isCurrent });
      }
      for (const npc of (s.public?.npcs ?? [])) {
        allNpcs.push({ npc, scene: s, isCurrent });
      }
    }

    allItems.sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));
    allNpcs.sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));

    return { items: allItems, npcs: allNpcs };
  }, [scenes, scene?.id]);

  if (!selfPlayer?.character_id) {
    return <div className="text-xs text-gray-400 p-2">Нет привязанного персонажа у игрока.</div>;
  }

  if (!scene) {
    return <div className="text-xs text-gray-400 p-2">Сцена для вашего персонажа не найдена.</div>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="shrink-0 flex items-center gap-2 flex-wrap px-1 pb-2">
        <span className="text-sm font-semibold text-white truncate">
          {scene?.location?.name ?? (scene as any)?.name ?? scene.id}
        </span>
        {scene.datetime && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10 shrink-0">
            <Clock className="w-3 h-3" />
            {new Date(scene.datetime).toLocaleString('ru', {
              day: '2-digit', month: 'short',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {audio_player?.playing && (
        <div className="shrink-0 pb-2">
          <AudioPlayerPanel sessionId={sessionId} compact />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1 pb-2">
        <div className="text-xs text-gray-400 mb-2">Персонажи</div>

        <div className="flex gap-3 items-start">
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {charactersWithPlayer.map(({ character, player }) => {
                const isHere = inThisScene.has(charId(character));
                const opacity = isHere ? 'opacity-100' : 'opacity-[.35]';
                const title = isHere ? 'В этой сцене' : 'Не в этой сцене';

                return (
                  <div className={`group inline-block ${opacity}`} title={title} key={String(character.id)}>
                    <CharacterDraggableSquare
                      character={character}
                      player={player}
                      onInfo={() => entityDialogs.viewCharacter(character)}
                    />
                  </div>
                );
              })}
            </div>

            {charactersWithPlayer.length === 0 ? (
              <div className="text-xs text-muted-foreground mt-2">Нет персонажей, привязанных к игрокам.</div>
            ) : null}
          </div>

          <SceneMiniMap
            location={scene.location ?? null}
            locations={locations ?? (scene.location ? [scene.location] : [])}
            scenes={scenes}
            session={session}
            enabledPolygonIds={polygon_shown ?? []}
          />
        </div>

        {canRenderView ? (
          <div className="space-y-4 mt-4">
            <SceneDataView scene={scene} players={players} data={scene.data ?? {}} />
          </div>
        ) : (
          <div className="text-xs text-white/50 mt-4">SceneDataView не подключен в pluginUI.</div>
        )}

        <div className="space-y-4 mt-4">
          <div>
            <div className="text-xs text-gray-400 mb-2">Предметы</div>
            <div className="flex flex-wrap gap-2">
              {allScenesItemsAndNpcs.items.map(({ item, scene: itemScene, isCurrent }) => (
                <div key={String(item.id)} className="relative">
                  {!isCurrent && (
                    <div className="absolute -top-4 left-0 right-0 text-center z-10 pointer-events-none">
                      <span className="text-[10px] text-white/40 truncate max-w-full block leading-tight">
                        {itemScene?.location?.name ?? itemScene?.name ?? itemScene?.id}
                      </span>
                    </div>
                  )}

                  <div className={!isCurrent ? 'opacity-30 grayscale' : ''}>
                    <ItemDraggableSquare
                      item={item}
                      onInfo={() => entityDialogs.viewItem(item)}
                      contextItems={
                        isCurrent
                          ? [{ ...ContextActions.takeItem, onClick: () => takeItem(String(item.id)) }]
                          : []
                      }
                    />
                  </div>
                </div>
              ))}
              {allScenesItemsAndNpcs.items.length === 0 && (
                <div className="text-xs text-gray-500 italic">На сценах нет предметов.</div>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-2">NPC</div>
            <div className="flex flex-wrap gap-2">
              {allScenesItemsAndNpcs.npcs.map(({ npc, scene: npcScene, isCurrent }) => (
                <div key={String(npc.id)} className="relative">
                  {!isCurrent && (
                    <div className="absolute -top-4 left-0 right-0 text-center z-10 pointer-events-none">
                      <span className="text-[10px] text-white/40 truncate max-w-full block leading-tight">
                        {npcScene?.location?.name ?? npcScene?.name ?? npcScene?.id}
                      </span>
                    </div>
                  )}

                  <div className={!isCurrent ? 'opacity-30 grayscale' : ''}>
                    <NPCDraggableSquare
                      npc={npc}
                      onInfo={() => entityDialogs.viewNpc(npc)}
                    />
                  </div>
                </div>
              ))}
              {allScenesItemsAndNpcs.npcs.length === 0 && (
                <div className="text-xs text-gray-500 italic">На сценах нет NPC.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-700 bg-gray-900/95 backdrop-blur-sm px-1 pt-2 pb-1 space-y-2">
        <PlayerSceneActionsPanel sessionId={sessionId} compact />
      </div>

      <SessionEntityDialogs {...entityDialogs} playerSeen={playerSeen} />
    </div>
  );
}
