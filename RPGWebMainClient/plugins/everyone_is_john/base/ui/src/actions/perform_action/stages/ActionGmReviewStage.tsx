// ActionGmReviewStage.tsx
'use client';
import React, { useEffect } from 'react';
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }
function clampInt(n: any, lo: number, hi: number, fb: number) {
  const v = Number(n); if (!Number.isFinite(v)) return fb;
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

export function ActionGmReviewStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const wf: any = action?.workflow ?? {};
  const ctx = (wf?.stageData && Object.keys(wf.stageData).length > 0)
    ? wf.stageData
    : (wf?.context ?? {});
  const entry = ctx?.entry ?? {};

  // правильное место для gmUserId
  const isGm = asStr(action?.participants?.gmUserId) === asStr(user_id);

  const baseDice = 3 + (entry.has_profession ? 4 : 0) + 2 * (entry.spend_tokens ?? 0);

  const handleDecision = (decision: string) => {
    onSubmit({
      decision,
      dice_override: value?.dice_override ?? null,
      comment: value?.comment ?? null,
    });
  };

  useEffect(() => {
    if (isGm) setSubmitEnabled(true);
    return () => setSubmitEnabled(false); // восстанавливаем при анмаунте
  }, [isGm]);

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Проверка заявки</div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30 space-y-1 text-sm">
        <div>Персонаж: <span className="font-semibold">{asStr(entry?.characterName, '—')}</span></div>
        {entry.description && <div className="text-white/80 italic">«{entry.description}»</div>}
        <div>Профессия: <span className={entry.has_profession ? 'text-green-300' : 'text-white/40'}>
          {entry.has_profession ? `${asStr(entry.profession)} (+4d6)` : 'не используется'}
        </span></div>
        <div>Жетонов: <span className="text-white/80">{entry.spend_tokens ?? 0} (+{2*(entry.spend_tokens??0)}d6)</span></div>
        <div>Итого кубиков: <span className="font-semibold">{baseDice}d6</span></div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-white/70 shrink-0">Переопределить кубики:</label>
        <input
          className="w-20 rounded border bg-zinc-950/30 px-3 py-2 text-sm"
          type="number" min={1} max={50}
          value={value?.dice_override ?? baseDice}
          onChange={(e) => patch({ dice_override: clampInt(e.target.value, 1, 50, baseDice) })}
        />
      </div>

      <textarea
        className="w-full rounded border bg-zinc-950/30 px-3 py-2 text-sm resize-none"
        placeholder="Комментарий игроку (необязательно)…"
        rows={2}
        value={value?.comment ?? ''}
        onChange={(e) => patch({ comment: e.target.value || null })}
      />

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className="flex items-center gap-1.5 border-2 border-green-500/50 rounded px-3 py-2 text-sm font-semibold text-green-300"
          onClick={() => handleDecision('approve')}
        >
          <CheckCircle className="w-4 h-4" /> Одобрить
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 border-2 border-yellow-500/50 rounded px-3 py-2 text-sm font-semibold text-yellow-300"
          onClick={() => handleDecision('return')}
        >
          <RotateCcw className="w-4 h-4" /> Вернуть игроку
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 border-2 border-red-500/50 rounded px-3 py-2 text-sm font-semibold text-red-300"
          onClick={() => handleDecision('reject')}
        >
          <XCircle className="w-4 h-4" /> Отклонить
        </button>
      </div>
    </div>
  );
}
