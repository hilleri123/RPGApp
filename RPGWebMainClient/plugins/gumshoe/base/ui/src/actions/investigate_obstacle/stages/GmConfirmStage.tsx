// stages/GmConfirmStage.tsx
'use client';
import React, { useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function GmConfirmStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const wf: any  = action?.workflow ?? {};
  const ctx      = wf?.context ?? {};
  const entry    = ctx?.entry ?? {};
  const obstacle = ctx?.obstacle ?? {};
  const spendRecords: any[] = entry?.spend_records ?? [];

  const isGm = asStr(action?.participants?.gmUserId) === asStr(user_id);

  // последний pending-запрос (confirmed=false)
  const pending = [...spendRecords].reverse().find((r: any) => !r.confirmed);

  // находим определение ClueSpend в снимке obstacle, чтобы показать info
  const spendDef = (obstacle?.spends ?? []).find((s: any) => s.name === pending?.clue_spend_name);

  useEffect(() => {
    setSubmitEnabled(false); // GM жмёт руками
  }, []);

  const handleDecision = (decision: 'approve' | 'reject') => {
    onSubmit({ decision, comment: value?.comment ?? null });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Запрос на покупку улики</div>

      {!pending ? (
        <div className="text-sm text-white/40">Нет активных запросов</div>
      ) : (
        <>
          {/* Карточка запроса */}
          <div className="rounded border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 space-y-1 text-sm">
            <div>
              Улика: <span className="font-semibold text-yellow-200">{pending.clue_spend_name}</span>
            </div>
            <div className="text-white/60">
              Навык: <span className="text-white/80">{pending.skill_name}</span>
              {' '}· Стоимость: <span className="text-white/80">{pending.cost} pts</span>
            </div>
            {spendDef?.info && (
              <div className="text-xs text-white/40 italic mt-1">
                Игрок получит: «{spendDef.info}»
              </div>
            )}
          </div>

          {/* Контекст — что уже куплено */}
          {spendRecords.filter((r: any) => r.confirmed).length > 0 && (
            <div className="text-xs text-white/40 space-y-0.5">
              <div className="uppercase tracking-wide mb-1">Уже куплено в этой сессии</div>
              {spendRecords
                .filter((r: any) => r.confirmed)
                .map((r: any, i: number) => (
                  <div key={i}>
                    ✓ {r.clue_spend_name} ({r.skill_name}, {r.cost} pts)
                  </div>
                ))}
            </div>
          )}

          <textarea
            className="w-full rounded border bg-zinc-950/30 px-3 py-2 text-sm resize-none"
            placeholder="Комментарий (необязательно)…"
            rows={2}
            value={value?.comment ?? ''}
            onChange={(e) => patch({ comment: e.target.value || null })}
          />

          {isGm ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDecision('approve')}
                className="flex items-center gap-1.5 rounded border-2 border-green-500/50 px-3 py-2 text-sm font-semibold text-green-300"
              >
                <CheckCircle className="w-4 h-4" /> Подтвердить
              </button>
              <button
                type="button"
                onClick={() => handleDecision('reject')}
                className="flex items-center gap-1.5 rounded border-2 border-red-500/50 px-3 py-2 text-sm font-semibold text-red-300"
              >
                <XCircle className="w-4 h-4" /> Отклонить
              </button>
            </div>
          ) : (
            <div className="text-sm text-white/40 italic">
              Ожидаем решения мастера…
            </div>
          )}
        </>
      )}
    </div>
  );
}
