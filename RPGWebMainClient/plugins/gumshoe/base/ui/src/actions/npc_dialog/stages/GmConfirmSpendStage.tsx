// plugins/gumshoe/npc_dialog/stages/GmConfirmSpendStage.tsx
'use client';
import React, { useEffect } from 'react';
import { CheckCircle, ShoppingCart, XCircle } from 'lucide-react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function GmConfirmSpendStage({ user_id, action, onSubmit, setSubmitEnabled }: any) {
  const wf    = action?.workflow ?? {};
  const ctx   = wf?.context ?? {};
  const entry = ctx?.entry ?? {};
  const spendRecords: any[] = entry?.spend_records ?? [];

  const scene      = action?.scene?.scene ?? {};
  const characters: any[] = scene?.characters ?? [];

  // Pending — последняя неподтверждённая запись
  const pending = [...spendRecords].reverse().find((r: any) => !r.confirmed);
  const ch = characters.find((c: any) => String(c.id) === pending?.character_id);

  // Игрок всегда может нажать (он видит эту стадию по _visible_ids)
  useEffect(() => { setSubmitEnabled(false); }, []);

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <ShoppingCart className="w-4 h-4 text-yellow-400" />
        Запрос на трату навыка
      </div>

      {!pending ? (
        <div className="text-sm text-white/40">Нет активных запросов</div>
      ) : (
        <>
          <div className="rounded border border-yellow-500/30 bg-yellow-500/5 px-3 py-3 space-y-2 text-sm">
            <div>
              Мастер запрашивает трату навыка у{' '}
              <span className="font-semibold text-yellow-200">
                {asStr(ch?.name, pending.character_id)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-white/70">
              <span>
                Навык:{' '}
                <span className="text-white font-semibold">{pending.skill_name}</span>
              </span>
              <span>
                Стоимость:{' '}
                <span className="text-white font-semibold">{pending.cost} pts</span>
              </span>
            </div>
            {/* {pending.note && (
              <div className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/60 italic">
                «{pending.note}»
              </div>
            )} */}
          </div>

          {/* Уже потраченное */}
          {spendRecords.filter((r: any) => r.confirmed).length > 0 && (
            <div className="text-xs text-white/40 space-y-0.5">
              <div className="uppercase tracking-wide mb-1">Уже потрачено</div>
              {spendRecords.filter((r: any) => r.confirmed).map((r: any, i: number) => {
                const c = characters.find((x: any) => String(x.id) === r.character_id);
                return (
                  <div key={i}>
                    ✓ {asStr(c?.name, '—')} · {r.skill_name} −{r.cost} pts
                    {r.note && <span className="text-white/30"> ({r.note})</span>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSubmit({ decision: 'approve' })}
              className="flex-1 flex items-center justify-center gap-1.5 rounded border-2 border-green-500/50 px-3 py-2 text-sm font-semibold text-green-300 hover:bg-green-500/10 transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Потратить
            </button>
            <button
              type="button"
              onClick={() => onSubmit({ decision: 'reject' })}
              className="flex-1 flex items-center justify-center gap-1.5 rounded border-2 border-red-500/50 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <XCircle className="w-4 h-4" /> Отказаться
            </button>
          </div>
        </>
      )}
    </div>
  );
}