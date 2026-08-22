'use client';

import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';

// твой обработчик фазы боёвки
import { JSX } from 'react';
// import RollInitiativeStage from './scene_battle_initiative_roll/RollInitiativeStage';
import PerformActionStage from './perform_move/PerformMoveStage';


type Handler = (props: ActionHandlerProps) => JSX.Element;

const HANDLERS: Record<string, Handler> = {
  // 'roll_initiative': RollInitiativeStage,
  'perform_move': PerformActionStage,  // +
};

export default function ActionKeyHandler(props: ActionHandlerProps) {
  const key = String(props?.action?.actionKey ?? '');
  const Cmp = HANDLERS[key];

  if (!Cmp) {
    return (
      <div className="rounded border p-3 bg-zinc-950/30">
        <div className="font-medium">Нет обработчика</div>
        <div className="text-sm text-muted-foreground mt-1">
          actionKey: <span className="text-white/80">{key || '—'}</span>
        </div>
      </div>
    );
  }

  return <Cmp {...props} />;
}
