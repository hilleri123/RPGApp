// plugins/gumshoe/task_bonus/stages/CompletedStage.tsx
'use client';
import React, { useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export function CompletedStage({ action, setSubmitEnabled }: any) {
  const entry    = action?.workflow?.context?.entry ?? {};
  const approved = entry?.decision === 'approve';

  useEffect(() => {
    setSubmitEnabled(false);
  }, []);

  return (
    <div className={`
      rounded border px-3 py-2 text-sm flex items-center gap-2
      ${approved
        ? 'border-green-500/40 bg-green-500/5 text-green-200'
        : 'border-red-500/40 bg-red-500/5 text-red-200'}
    `}>
      {approved ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      <div>
        <div className="font-semibold">
          {approved ? 'Бонус подтверждён' : 'Отклонено'}
        </div>
        {approved && (
          <div className="text-xs text-white/60 mt-0.5">
            {entry.task_bonus > 0 ? `+${entry.task_bonus}` : entry.task_bonus} бонусов
            {' · '}{entry.task_description}
          </div>
        )}
        {entry.comment && (
          <div className="text-xs text-white/50 mt-0.5 italic">{entry.comment}</div>
        )}
      </div>
    </div>
  );
}