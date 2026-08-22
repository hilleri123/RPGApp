// stages/InvestigateResultStage.tsx
'use client';
import React, { useEffect } from 'react';
import { CheckCircle, Coins } from 'lucide-react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function InvestigateResultStage({ user_id, action, onSubmit, setSubmitEnabled }: any) {
  const wf: any   = action?.workflow ?? {};
  const ctx       = wf?.context ?? {};
  const entry     = ctx?.entry ?? {};
  const obstacle  = ctx?.obstacle ?? {};
  const isDone    = wf?.stageKey === 'done';

  const spendRecords: any[] = entry?.spend_records ?? [];
  const confirmed = spendRecords.filter((r: any) => r.confirmed);

  const isGm = asStr(action?.participants?.gmUserId) === asStr(user_id);

  // GM должен нажать Submit чтобы закрыть и применить sessionPatch
  useEffect(() => {
    if (isGm && !isDone) setSubmitEnabled(true);
    else setSubmitEnabled(false);
  }, [isGm, isDone]);

  // считаем итоговые траты по скиллам
  const spentBySkill: Record<string, number> = {};
  for (const r of confirmed) {
    spentBySkill[r.skill_name] = (spentBySkill[r.skill_name] ?? 0) + r.cost;
  }

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-400" />
        {isDone ? 'Расследование завершено' : 'Подвести итог'}
      </div>


      {/* base_text */}
      {obstacle?.base_text && (
        <div className="rounded border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm text-blue-200">
          {obstacle.base_text}
        </div>
      )}

      {/* Купленные улики */}
      {confirmed.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-white/50 uppercase tracking-wide">Получено улик</div>
          {confirmed.map((r: any, i: number) => (
            <div key={i} className="rounded border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm">
              <div className="font-semibold text-green-200">{r.clue_spend_name}</div>
              {r.info && <div className="text-white/70 mt-0.5">{r.info}</div>}
              <div className="text-xs text-white/40 mt-0.5">
                {r.skill_name} · {r.cost} pts
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-white/40">Улики не куплены</div>
      )}

      {/* Итог по списанию */}
      {Object.keys(spentBySkill).length > 0 && (
        <div className="rounded border px-3 py-2 bg-zinc-950/30 text-sm space-y-0.5">
          <div className="text-xs text-white/50 uppercase tracking-wide flex items-center gap-1 mb-1">
            <Coins className="w-3 h-3" /> Будет списано
          </div>
          {Object.entries(spentBySkill).map(([skill, pts]) => (
            <div key={skill} className="flex justify-between">
              <span className="text-white/70">{skill}</span>
              <span className="text-red-300 font-semibold tabular-nums">−{pts} pts</span>
            </div>
          ))}
        </div>
      )}

      {isGm && !isDone && (
        <div className="text-xs text-white/40 italic">
          Нажми «Отправить» — очки спишутся и действие закроется.
        </div>
      )}

      {isDone && (
        <div className="rounded border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-300">
          Действие завершено. Очки списаны.
        </div>
      )}
    </div>
  );
}
