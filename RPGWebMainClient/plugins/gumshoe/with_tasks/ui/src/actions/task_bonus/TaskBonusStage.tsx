// plugins/gumshoe/task_bonus/TaskBonusStage.tsx
'use client';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { PlayerRequestStage } from './stages/PlayerRequestStage';
import { GmConfirmStage }     from './stages/GmConfirmStage';
import { CompletedStage }     from './stages/CompletedStage';

export default function TaskBonusStage(props: ActionHandlerProps) {
  const { action, value, onChange, onSubmit, setSubmitEnabled } = props;
  const patch = (p: any) => onChange({ ...(value ?? {}), ...(p ?? {}) });
  const stageKey = String(action?.workflow?.stageKey ?? '');

  const stageProps = { ...props, patch };

  if (stageKey === 'gumshoe.task_bonus.request' || stageKey === '')
    return <PlayerRequestStage {...stageProps} />;
  if (stageKey === 'gumshoe.task_bonus.gm_confirm')
    return <GmConfirmStage {...stageProps} />;
  if (stageKey === 'completed')
    return <CompletedStage {...stageProps} />;

  return <div className="text-sm text-white/60">Стадия: {stageKey}</div>;
}