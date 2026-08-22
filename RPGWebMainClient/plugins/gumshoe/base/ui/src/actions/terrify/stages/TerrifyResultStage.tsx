'use client';

import React, { useEffect } from 'react';
import { Skull, ShieldCheck, ShieldX } from 'lucide-react';
import { DiceRollDisplay, DiceInterpreter } from '@/plugins/common/ui';

export function TerrifyResultStage({ user_id, action, value, onSubmit, setSubmitEnabled }: any) {
  const wf = action?.workflow ?? {};
  const ctx = wf?.context ?? {};
  const targets: any[] = ctx?.targets ?? [];
  const damage: number = ctx?.damage ?? 0;
  const participants = action?.participants ?? {};
  const isGm = String(participants?.gmUserId ?? '') === String(user_id);
  const isDone = wf?.stageKey === 'completed';

  useEffect(() => {
    setSubmitEnabled(isGm && !isDone);
  }, [isGm, isDone]);

  const handleSubmit = () => {
    if (!isGm || isDone) return;
    onSubmit({ action: 'finish' });
  };

  const passed = targets.filter((t) => t.passed);
  const failed = targets.filter((t) => !t.passed);

  const interpreter = (t: any): DiceInterpreter =>
    ({ dice: d, total: tot }) => {
      if (!d.length) return { dieColors: [], outcome: null };
      const total = tot ?? d[0];
      const ok = total > 4;
      return {
        dieColors: [ok ? 'good' : 'bad'],
        outcome: {
          label: ok ? 'Устоял' : 'Провал',
          color: ok ? 'good' : 'bad',
          effect: ok
            ? `${d[0]} + ${t.sanity_points} pts = ${total}`
            : `${d[0]} + ${t.sanity_points} pts = ${total} — -${damage} к стабильности`,
        },
      };
    };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <Skull className="w-4 h-4 text-purple-400" />
        Terrify — результат
        <span className="text-xs text-white/40 font-normal">урон: {damage}</span>
      </div>

      {passed.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs text-green-400 uppercase tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5" />
            Устояли
          </div>
          {passed.map((t: any) => (
            <div
              key={t.characterId}
              className="rounded border border-green-500/30 bg-green-500/5 p-3 flex flex-col gap-2"
            >
              <div className="text-sm font-semibold text-white/80">{t.name}</div>
              {t.dice?.length > 0 && (
                <DiceRollDisplay
                  dice={t.dice}
                  total={t.total}
                  rollLabel={`1d6 + ${t.sanity_points} pts`}
                  interpreter={interpreter(t)}
                  canvasSeed={t.canvas_seed ?? null}
                  animKey={`result-${t.characterId}`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {failed.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs text-red-400 uppercase tracking-wide">
            <ShieldX className="w-3.5 h-3.5" />
            Провалились — -{damage} к стабильности
          </div>
          {failed.map((t: any) => (
            <div
              key={t.characterId}
              className="rounded border border-red-500/30 bg-red-500/5 p-3 flex flex-col gap-2"
            >
              <div className="text-sm font-semibold text-white/80">{t.name}</div>
              {t.dice?.length > 0 && (
                <DiceRollDisplay
                  dice={t.dice}
                  total={t.total}
                  rollLabel={`1d6 + ${t.sanity_points} pts`}
                  interpreter={interpreter(t)}
                  canvasSeed={t.canvas_seed ?? null}
                  animKey={`result-${t.characterId}`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {isDone && (
        <div className="rounded border border-green-500/20 bg-green-500/5 p-3 text-sm text-green-100">
          Terrify завершён. Стабильность обновлена.
        </div>
      )}

      {isGm && !isDone && (
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded border border-purple-400/70 px-3 py-2 text-sm font-semibold text-purple-200 hover:bg-purple-500/10"
        >
          Применить и завершить
        </button>
      )}
    </div>
  );
}
