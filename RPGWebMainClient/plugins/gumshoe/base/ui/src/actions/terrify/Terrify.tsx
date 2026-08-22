// plugins/gumshoe/investigate_obstacle/InvestigateObstacleStage.tsx
'use client';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { TerrifySetupStage } from './stages/TerrifySetupStage';
import { TerrifyRollStage } from './stages/TerrifyRollStage';
import { TerrifyResultStage } from './stages/TerrifyResultStage';

export default function Terrify(props: ActionHandlerProps) {
  const { action, user_id, value, onChange, onSubmit, setSubmitEnabled } = props;
  const patch = (p: any) => onChange({ ...(value ?? {}), ...(p ?? {}) });
  const stageKey = String(action?.workflow?.stageKey ?? 'done');

  const stageProps = { user_id, action, value, patch, onSubmit, setSubmitEnabled };

  if (stageKey === 'gumshoe.terrify.setup')
    return <TerrifySetupStage {...stageProps} />;
  if (stageKey === 'gumshoe.terrify.roll')
    return <TerrifyRollStage {...stageProps} />;
  if (stageKey === 'gumshoe.terrify.result' || stageKey === 'done')
    return <TerrifyResultStage {...stageProps} />;

  return <div className="text-sm text-white/60">Стадия: {stageKey}</div>;
}
