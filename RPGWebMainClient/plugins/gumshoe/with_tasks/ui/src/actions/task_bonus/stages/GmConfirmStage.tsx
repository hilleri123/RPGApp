// plugins/gumshoe/task_bonus/stages/GmConfirmStage.tsx
'use client';
import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Star } from 'lucide-react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function GmConfirmStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const entry = action?.workflow?.context?.entry ?? {};
  const isGm  = asStr(action?.participants?.gmUserId) === asStr(user_id);

  useEffect(() => {
    setSubmitEnabled(false);
  }, []);

  if (!isGm) {
    return (
      <div className="rounded border p-3 text-sm text-white/50 italic">
        Ожидаем решения мастера…
      </div>
    );
  }

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <Star className="w-4 h-4 text-yellow-300" />
        Запрос на бонус
      </div>

      <div className="rounded border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-sm space-y-1">
        <div>
          Задание:{' '}
          <span className="font-semibold text-yellow-200">{entry.task_description}</span>
        </div>
        <div className="text-white/60">
          Бонус:{' '}
          <span className={`font-semibold ${entry.task_bonus >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {entry.task_bonus > 0 ? `+${entry.task_bonus}` : entry.task_bonus}
          </span>
        </div>
      </div>

      <textarea
        className="w-full rounded border bg-zinc-950/30 px-3 py-2 text-sm resize-none"
        placeholder="Комментарий (необязательно)…"
        rows={2}
        value={value?.comment ?? ''}
        onChange={(e) => patch({ comment: e.target.value || null })}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSubmit({ decision: 'approve', comment: value?.comment ?? null })}
          className="flex items-center gap-1.5 rounded border-2 border-green-500/50 px-3 py-2 text-sm font-semibold text-green-300 hover:bg-green-500/10 transition-colors"
        >
          <CheckCircle className="w-4 h-4" /> Подтвердить
        </button>
        <button
          type="button"
          onClick={() => onSubmit({ decision: 'reject', comment: value?.comment ?? null })}
          className="flex items-center gap-1.5 rounded border-2 border-red-500/50 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <XCircle className="w-4 h-4" /> Отклонить
        </button>
      </div>
    </div>
  );
}