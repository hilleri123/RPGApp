'use client';

import { useEffect } from 'react';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import type { StageKey } from './stageTypes';
import { getDefaultDraft } from './stageDefaults';

import { SwitchPhaseConfirmStage } from './stages/SwitchPhaseConfirmStage';
import { DoneStage } from './stages/DoneStage'; // или свой DoneStage

export default function SwitchCombatPhaseStage({ user_id, action, value, onChange }: ActionHandlerProps) {
  const wf: any = action?.workflow ?? {};
  const stageKey: StageKey = (wf.stageKey ?? 'done') as StageKey;

  const patch = (p: any) => onChange({ ...(value ?? {}), ...(p ?? {}) });

  // дефолты для draft при смене stageKey
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
    case 'switch_phase.confirm':
      return <SwitchPhaseConfirmStage user_id={user_id} action={action} value={value} patch={patch} />;

    case 'done':
    default:
      return <DoneStage actionKey={action.actionKey} />;
  }
}
