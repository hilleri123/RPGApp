'use client';

import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { RollInitiativeBetStage } from './stages/RollInitiativeBetStage';
import { RollInitiativeTieRollStage } from './stages/RollInitiativeTieRollStage';
import { RollInitiativeResultStage } from './stages/RollInitiativeResultStage';
import { RollInitiativeDoneStage } from './stages/RollInitiativeDoneStage';
import { RollInitiativeTieCanvasStage } from './stages/RollInitiativeTieCanvasStage';

export default function RollInitiativeStage(props: ActionHandlerProps) {
  const { action, user_id, value, onChange, setSubmitEnabled, onSubmit } = props;
  const patch = (p: any) => onChange({ ...(value ?? {}), ...(p ?? {}) });

  const wf: any = action?.workflow ?? {};
  const stageKey = String(wf?.stageKey ?? 'done');

  if (stageKey === 'initiative.bet') {
    return <RollInitiativeBetStage user_id={user_id} action={action} value={value} patch={patch} />;
  }
  if (stageKey === 'initiative.tie_canvas') {
    return <RollInitiativeTieCanvasStage user_id={user_id} action={action} value={value} patch={patch} setSubmitEnabled={setSubmitEnabled} />;
  }
  if (stageKey === 'initiative.tie_roll') {
    return <RollInitiativeTieRollStage user_id={user_id} action={action} value={value} patch={patch} onSubmit={onSubmit} />;
  }
  if (stageKey === 'initiative.result' || stageKey === 'done') {
    return <RollInitiativeResultStage user_id={user_id} action={action} />;
  }
  return <RollInitiativeDoneStage user_id={user_id} action={action} value={value} patch={patch} />;
}
