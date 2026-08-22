'use client';

import React, { useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';

import Panel from './Panel';
import { CharacterDraggableSquare, parsePlayerCharacterFromDragEvent } from '@/app/components/common/squares/CharacterDraggableSquare';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { Player } from '@/app/services/types/lobby';
import type { Scene } from '@/app/services/types/session';
import { ContextActions } from '@/app/components/common/DraggableSquare';
import type { useSessionEntityDialogs } from '@/app/services/hooks/session/useSessionEntityDialogs';
import SceneMiniMap from '@/app/components/session/common/SceneMiniMap';

const playerCharacterId = (p: any) => String(p?.character_id ?? p?.characterid ?? '');
const charId = (c: any) => String(c?.id ?? '');

export default function SceneAllCharactersPanel({
  scene,
  entityDialogs,
}: {
  scene: Scene;
  entityDialogs: ReturnType<typeof useSessionEntityDialogs>;
}) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const {
    session,
    characters,
    isMaster,
    moveCharacterToScene,
    locations,
    scenes,
    polygon_shown,
  } = useSessionWebSocket(sessionId) as any;

  const players: Player[] = session?.players ?? [];

  const inThisScene = useMemo(() => {
    const idsFromArray = Array.isArray((scene as any)?.character_ids)
      ? (scene as any).character_ids
      : (scene as any)?.characters?.map((c: any) => c?.id) ?? [];
    return new Set((idsFromArray ?? []).map((x: any) => String(x)));
  }, [scene]);

  const charactersWithPlayer = useMemo(() => {
    const list = Array.isArray(characters) ? characters : [];
    return list
      .map((character: any) => {
        const player = players.find((p: any) => playerCharacterId(p) === charId(character));
        return player ? { character, player } : null;
      })
      .filter(Boolean) as Array<{ character: any; player: Player }>;
  }, [characters, players]);

  const sceneLocation = (scene as any)?.location ?? null;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isMaster) return;
    if (e.dataTransfer.types.includes('application/element-type')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, [isMaster]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!isMaster) return;
      const character = parsePlayerCharacterFromDragEvent(e);
      if (!character?.id) return;
      if (inThisScene.has(String(character.id))) return;
      moveCharacterToScene(character.id, scene.id);
    },
    [isMaster, inThisScene, moveCharacterToScene, scene.id],
  );

  return (
    <Panel title="Персонажи">
      <div className="flex gap-3 items-start">
        <div
          className="flex-1 min-w-0 rounded border border-transparent border-dashed hover:border-zinc-700/80 px-1 py-1 -mx-1"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="flex gap-2 flex-wrap min-h-[3rem]">
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
                    contextItems={[
                      {
                        ...ContextActions.edit,
                        label: 'Редактировать',
                        onClick: () => entityDialogs.editCharacter(character),
                      },
                      ...(isMaster
                        ? [
                            {
                              ...ContextActions.addToScene,
                              label: isHere ? 'Уже в этой сцене' : 'Переместить в эту сцену',
                              onClick: () => {
                                if (isHere) return;
                                moveCharacterToScene(character.id, scene.id);
                              },
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              );
            })}
            {isMaster && charactersWithPlayer.length > 0 ? (
              <div className="text-[10px] text-muted-foreground opacity-50 self-center pl-1">
                Перетащи персонажа сюда
              </div>
            ) : null}
          </div>

          {charactersWithPlayer.length === 0 ? (
            <div className="text-xs text-muted-foreground mt-2">
              {isMaster
                ? 'Нет персонажей у игроков. Перетащи персонажа из вкладки Контент → Персонажи.'
                : 'Нет персонажей, привязанных к игрокам.'}
            </div>
          ) : null}
        </div>

        <SceneMiniMap
          location={sceneLocation}
          locations={locations ?? (sceneLocation ? [sceneLocation] : [])}
          scenes={scenes}
          session={session}
          enabledPolygonIds={polygon_shown ?? []}
        />
      </div>
    </Panel>
  );
}
