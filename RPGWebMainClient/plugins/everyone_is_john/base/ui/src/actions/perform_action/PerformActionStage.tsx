'use client';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { ActionDeclareStage }   from './stages/ActionDeclareStage';
import { ActionGmReviewStage }  from './stages/ActionGmReviewStage';
import { ActionCanvasStage }    from './stages/ActionCanvasStage';
import { ActionResultStage }    from './stages/ActionResultStage';

export default function PerformActionStage(props: ActionHandlerProps) {
  const { action, user_id, value, onChange, onSubmit, setSubmitEnabled } = props;
  const patch = (p: any) => onChange({ ...(value ?? {}), ...(p ?? {}) });
  const stageKey = String(action?.workflow?.stageKey ?? 'done');

  const stageProps = { user_id, action, value, patch, onSubmit, setSubmitEnabled };

  if (stageKey === 'john.action.declare')
    return <ActionDeclareStage {...stageProps} />;
  if (stageKey === 'john.action.gm_review')
    return <ActionGmReviewStage {...stageProps} />;
  if (stageKey === 'john.action.canvas')
    return <ActionCanvasStage {...stageProps} />;
  if (stageKey === 'john.action.result' || stageKey === 'done')
    return <ActionResultStage {...stageProps} />;

  return <div className="text-sm text-white/60">Стадия: {stageKey}</div>;
}
