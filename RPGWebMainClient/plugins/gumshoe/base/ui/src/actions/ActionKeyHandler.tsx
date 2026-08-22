'use client';

import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';

// твой обработчик фазы боёвки
import { JSX } from 'react';
import InvestigateObstacleStage from './investigate_obstacle/InvestigateObstacleStage';
import AttackStage from './attack/AttackStage';
import ContestStage from './contest/ContestStage';
import Terrify from './terrify/Terrify';
import NpcDialogStage from './npc_dialog/NpcDialogStage';


type Handler = (props: ActionHandlerProps) => JSX.Element;

export const HANDLERS: Record<string, Handler> = {
  'gumshoe.investigate_obstacle': InvestigateObstacleStage,
  'gumshoe.attack': AttackStage,
  'gumshoe.contest': ContestStage,
  'gumshoe.terrify': Terrify,
  'gumshoe.npc_dialog': NpcDialogStage,
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
