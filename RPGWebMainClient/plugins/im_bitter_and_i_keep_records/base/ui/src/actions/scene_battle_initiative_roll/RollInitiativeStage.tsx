'use client';

import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { RollInitiativeRollOneStage } from './stages/RollInitiativeRollOneStage';
import { RollInitiativeDoneStage } from './stages/RollInitiativeDoneStage';
import { RollInitiativeResultStage } from './stages/RollInitiativeResultStage';

export default function RollInitiativeStage(props: ActionHandlerProps) {
  const { action, user_id, value, onChange } = props;
  const patch = (p: any) => onChange({ ...(value ?? {}), ...(p ?? {}) });

  const wf: any = action?.workflow ?? {};
  const stageKey = String(wf?.stageKey ?? 'done');

  if (stageKey === 'initiative.roll_one') {
    return <RollInitiativeRollOneStage user_id={user_id} action={action} value={value} patch={patch} />;
  }
  if (stageKey === 'initiative.result' || stageKey === 'done') {
    return <RollInitiativeResultStage user_id={user_id} action={action} />;
  }
  return <RollInitiativeDoneStage user_id={user_id} action={action} value={value} patch={patch} />;
}
