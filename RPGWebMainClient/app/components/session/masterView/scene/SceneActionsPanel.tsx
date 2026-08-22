'use client';

import { useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';

import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import type { Scene } from '@/app/services/types/session';
import { useMasterUiStore } from '@/app/services/stores/masterUi';
import Panel from './Panel';
import { SceneActionButtons } from '@/app/components/session/common/actions';

export default function SceneActionsPanel() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);
  const setCurrentSceneId = useMasterUiStore((s) => s.setCurrentSceneId);

  const { scenes, runSceneAction, isMaster, isPlayer, pluginUI } = useSessionWebSocket(sessionId) as any;

  const scene: Scene | undefined = useMemo(() => {
    if (!Array.isArray(scenes) || !currentSceneId) return undefined;
    return scenes.find((s: Scene) => s.id === currentSceneId);
  }, [scenes, currentSceneId]);

  const actions = scene?.available_actions ?? [];

  const onRun = useCallback((sceneId: string, actionKey: string) => {
    runSceneAction(sceneId, actionKey);
  }, [runSceneAction]);

  const role = isMaster ? 'gm' : isPlayer ? 'player' : 'gm';

  if (!scene) {
    if (!Array.isArray(scenes) || scenes.length === 0) {
      return <div className="text-sm text-gray-400">Сцены не найдены.</div>;
    }

    return (
      <div className="text-sm text-gray-400">
        Сцена не выбрана.
        <div className="mt-2 flex flex-wrap gap-2">
          {scenes.map((s: Scene) => (
            <button
              key={s.id}
              className="rounded bg-zinc-800 px-2 py-1 text-xs text-gray-200 hover:bg-zinc-700"
              onClick={() => setCurrentSceneId(s.id)}
            >
              {s.location?.name ?? 'Без названия'}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Panel title="Доступные действия">
      <div className="mt-2">
        <SceneActionButtons
          sceneId={scene.id}
          actions={actions}
          onRun={onRun}
          role={role}
          ActionLaunchHandler={pluginUI?.ActionLaunchHandler}
          emptyHint="Нет доступных действий на сцене."
        />
      </div>
    </Panel>
  );
}
