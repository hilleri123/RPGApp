// plugins/gumshoe/attack/AttackStage.tsx
'use client';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { AttackSetupStage }   from './stages/AttackSetupStage';
import { AttackRollStage }    from './stages/AttackRollStage';
import { AttackResultStage }  from './stages/AttackResultStage';
import { AttackDamageStage } from './stages/AttackDamageStage';

export default function AttackStage(props: ActionHandlerProps) {
  const { action, user_id, value, onChange, onSubmit, setSubmitEnabled } = props;
  const patch = (p: any) => onChange({ ...(value ?? {}), ...(p ?? {}) });
  const stageKey = String(action?.workflow?.stageKey ?? 'done');

  const stageProps = { user_id, action, value, patch, onSubmit, setSubmitEnabled };

  if (stageKey === 'gumshoe.attack.setup')
    return <AttackSetupStage {...stageProps} />;
  if (stageKey === 'gumshoe.attack.roll')
    return <AttackRollStage {...stageProps} />;
  if (stageKey === 'gumshoe.attack.damage')
    return <AttackDamageStage {...stageProps} />;
  if (stageKey === 'gumshoe.attack.result' || stageKey === 'completed')
    return <AttackResultStage {...stageProps} />;

  return <div className="text-sm text-white/60">Стадия: {stageKey}</div>;
}
