// plugins/gumshoe/contest/ContestStage.tsx
'use client';

import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { ContestSetupStage } from './stages/ContestSetupStage';
import { ContestSpendStage } from './stages/ContestSpendStage';
import { ContestRollStage } from './stages/ContestRollStage';
import { ContestResultStage } from './stages/ContestResultStage';

export default function ContestStage(props: ActionHandlerProps) {
  const { action, user_id, value, onChange, onSubmit, setSubmitEnabled } = props;
  const patch = (p: any) => onChange({ ...(value ?? {}), ...(p ?? {}) });
  const stageKey = String(action?.workflow?.stageKey ?? 'done');

  const stageProps = { user_id, action, value, patch, onSubmit, setSubmitEnabled };

  if (stageKey === 'gumshoe.contest.setup')
    return <ContestSetupStage {...stageProps} />;
  if (stageKey === 'gumshoe.contest.spend')
    return <ContestSpendStage {...stageProps} />;
  if (stageKey === 'gumshoe.contest.roll')
    return <ContestRollStage {...stageProps} />;
  if (stageKey === 'gumshoe.contest.result' || stageKey === 'completed')
    return <ContestResultStage {...stageProps} />;

  return <div className="text-sm text-white/60">Стадия: {stageKey}</div>;
}
