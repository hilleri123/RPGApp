// plugins/gumshoe/npc_dialog/NpcDialogStage.tsx
'use client';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { SelectParticipantsStage } from './stages/SelectParticipantsStage';
import { DialogLoopStage }          from './stages/DialogLoopStage';
import { GmConfirmSpendStage }      from './stages/GmConfirmSpendStage';
import { DialogResultStage }        from './stages/DialogResultStage';

export default function NpcDialogStage(props: ActionHandlerProps) {
  const { action, user_id, value, onChange, onSubmit, setSubmitEnabled } = props;
  const patch    = (p: any) => onChange({ ...(value ?? {}), ...(p ?? {}) });
  const stageKey = String(action?.workflow?.stageKey ?? 'completed');
  const sp       = { user_id, action, value, patch, onSubmit, setSubmitEnabled };

  if (stageKey === 'gumshoe.npc_dialog.select_participants') return <SelectParticipantsStage {...sp} />;
  if (stageKey === 'gumshoe.npc_dialog.dialog_loop')         return <DialogLoopStage {...sp} />;
  if (stageKey === 'gumshoe.npc_dialog.gm_confirm_spend')    return <GmConfirmSpendStage {...sp} />;
  if (stageKey === 'gumshoe.npc_dialog.result' || stageKey === 'completed') return <DialogResultStage {...sp} />;

  return <div className="text-sm text-white/60">Стадия: {stageKey}</div>;
}