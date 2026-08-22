'use client';

import { useEffect } from 'react';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import type { StageKey } from './stageTypes';
import { getDefaultDraft } from './stageDefaults';

import { ChooseActionStage } from './stages/ChooseActionStage';
import { GmSetPositionEffectStage } from './stages/GmSetPositionEffectStage';
import { PlayerAddModsStage } from './stages/PlayerAddModsStage';
import { AssistConfirmStage } from './stages/AssistConfirmStage';
import { GmFinalizeStage } from './stages/GmFinalizeStage';
import { PreRollConfirmStage } from './stages/PreRollConfirmStage';
import { MitigateStage } from './stages/MitigateStage';
import { ResistStage } from './stages/ResistStage';
import { WrapUpStage } from './stages/WrapUpStage';
import { DoneStage } from './stages/DoneStage';
import { CompletedSummaryStage } from './stages/CompletedSummaryStage';

export default function RollActionStage({ user_id, action, value, onChange }: ActionHandlerProps) {
  const wf: any = action?.workflow ?? {};
  const stageKey: StageKey = (wf.stageKey ?? 'done') as StageKey;


  if (action?.status === 'completed') {
    return <CompletedSummaryStage action={action} />;
  }

  const patch = (p: any) => onChange({ ...(value ?? {}), ...(p ?? {}) });

  // Инициализация дефолтов при смене stageKey (и только если реально есть недостающие поля).
  useEffect(() => {
    const v = (value ?? {}) as Record<string, unknown>;
    const d = getDefaultDraft(stageKey, v) as Record<string, unknown>;

    const next: Record<string, unknown> = {};
    for (const k of Object.keys(d)) {
      if (v[k] == null) next[k] = d[k];
    }

    if (Object.keys(next).length > 0) patch(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageKey]);

  switch (stageKey) {
    case 'choose_action':
      return <ChooseActionStage user_id={user_id} action={action} value={value} patch={patch} />;

    case 'gm_set_position_effect':
      return <GmSetPositionEffectStage action={action} value={value} patch={patch} />;

    case 'player_add_mods':
      return <PlayerAddModsStage action={action} value={value} patch={patch} user_id={user_id} />;

    case 'assist_confirm':
      return <AssistConfirmStage action={action} value={value} patch={patch} />;

    case 'gm_finalize':
      return <GmFinalizeStage action={action} value={value} patch={patch} />;

    case 'prerollconfirm':
      return <PreRollConfirmStage action={action} value={value} patch={patch} user_id={user_id} />;

    case 'mitigate':
      return <MitigateStage action={action} value={value} patch={patch} />;

    case 'resist':
      return <ResistStage action={action} value={value} patch={patch} />;

    case 'wrap_up':
      return <WrapUpStage action={action} value={value} patch={patch} />;

    case 'done':
    default:
      return <DoneStage actionKey={action.actionKey} />;
  }
}
