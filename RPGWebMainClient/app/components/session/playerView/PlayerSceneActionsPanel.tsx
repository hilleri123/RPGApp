'use client';

import React, { useCallback } from 'react';
import { usePlayerSessionWebSocket } from '@/app/services/hooks/usePlayerSessionWebSocket';
import Panel from '../masterView/scene/Panel';
import { SceneActionButtons } from '@/app/components/session/common/actions';

export default function PlayerSceneActionsPanel({
  sessionId,
  compact = false,
}: {
  sessionId: string;
  compact?: boolean;
}) {
  const { scene, runSceneAction, pluginUI } = usePlayerSessionWebSocket(sessionId) as any;

  const actions = (scene as any)?.available_actions ?? [];

  const onRun = useCallback(
    (sceneId: string, actionKey: string) => {
      runSceneAction(sceneId, actionKey);
    },
    [runSceneAction],
  );

  if (!scene) {
    return null;
  }

  const visibleActions = actions.filter((a: any) => {
    if (!a.roles?.length) return true;
    return a.roles.includes('player');
  });

  if (!visibleActions.length) {
    return null;
  }

  const buttons = (
    <SceneActionButtons
      sceneId={scene.id}
      actions={actions}
      onRun={onRun}
      role="player"
      compact={compact}
      ActionLaunchHandler={pluginUI?.ActionLaunchHandler}
      emptyHint={null}
    />
  );

  if (compact) {
    return (
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Действия
        </div>
        {buttons}
      </div>
    );
  }

  return <Panel title="Действия">{buttons}</Panel>;
}
