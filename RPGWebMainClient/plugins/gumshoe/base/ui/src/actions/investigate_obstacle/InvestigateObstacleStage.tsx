// plugins/gumshoe/investigate_obstacle/InvestigateObstacleStage.tsx
'use client';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { SpendLoopStage }       from './stages/SpendLoopStage';
import { GmConfirmStage }       from './stages/GmConfirmStage';
import { InvestigateResultStage } from './stages/InvestigateResultStage';
import { AssignStage } from './stages/AssignStage';

export default function InvestigateObstacleStage(props: ActionHandlerProps) {
  const { action, user_id, value, onChange, onSubmit, setSubmitEnabled } = props;
  const patch = (p: any) => onChange({ ...(value ?? {}), ...(p ?? {}) });
  const stageKey = String(action?.workflow?.stageKey ?? 'completed');

  const stageProps = { user_id, action, value, patch, onSubmit, setSubmitEnabled };

  if (stageKey === 'gumshoe.investigate.assign')
    return <AssignStage {...stageProps} />;
  if (stageKey === 'gumshoe.investigate.spend_loop')
    return <SpendLoopStage {...stageProps} />;
  if (stageKey === 'gumshoe.investigate.gm_confirm')
    return <GmConfirmStage {...stageProps} />;
  if (stageKey === 'gumshoe.investigate.result' || stageKey === 'completed')
    return <InvestigateResultStage {...stageProps} />;

  return <div className="text-sm text-white/60">Стадия: {stageKey}</div>;
}
