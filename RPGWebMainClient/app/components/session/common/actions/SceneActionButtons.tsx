'use client';

import type { ComponentType } from 'react';
import type { ActionLaunchProps, SceneAvailableActionLite } from './DefaultActionLaunchButton';
import { resolveActionLauncher } from './resolveActionLauncher';

type Role = 'gm' | 'player';

type Props = {
  sceneId: string;
  actions: SceneAvailableActionLite[];
  onRun: (sceneId: string, actionKey: string) => void;
  role: Role;
  compact?: boolean;
  ActionLaunchHandler?: ComponentType<ActionLaunchProps> | null;
  emptyHint?: string | null;
};

export default function SceneActionButtons({
  sceneId,
  actions,
  onRun,
  role,
  compact = false,
  ActionLaunchHandler,
  emptyHint = 'Нет доступных действий.',
}: Props) {
  const visible = (actions ?? []).filter((a) => {
    if (!a.roles?.length) return true;
    if (role === 'gm' && a.roles.includes('gm')) return true;
    if (role === 'player' && a.roles.includes('player')) return true;
    return false;
  });

  if (!visible.length) {
    if (!emptyHint) return null;
    return <div className="text-sm text-zinc-500">{emptyHint}</div>;
  }

  return (
    <div className={compact ? 'flex flex-col gap-1.5' : 'flex flex-col gap-2'}>
      {visible.map((action) => {
        const Cmp = resolveActionLauncher(action.key, ActionLaunchHandler);
        return (
          <Cmp
            key={action.key}
            action={action}
            sceneId={sceneId}
            onRun={onRun}
            compact={compact}
          />
        );
      })}
    </div>
  );
}
