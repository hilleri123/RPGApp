// plugins/gumshoe/attack/stages/AttackRollStage.tsx
'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { CanvasSeed, DiceInterpreter, DiceRollDisplay } from '@/plugins/common/ui';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

// простой интерпретатор для GUMSHOE-атаки: 4+ — успех
export const gumshoeAttackInterpreter: DiceInterpreter = ({ dice }) => {
  if (!dice.length) {
    return { dieColors: [], outcome: null };
  }
  const v = dice[0];
  const color = v >= 4 ? 'good' : 'bad';
  const label = v >= 4 ? 'Попадание' : 'Промах';
  const effect = v >= 4 ? 'Ты попадаешь по цели.' : 'Твоя атака не наносит урона.';
  return {
    dieColors: [color],
    outcome: { label, color, effect },
  };
};

export function AttackRollStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const wf: any  = action?.workflow ?? {};
  const ctx      = wf?.context ?? {};
  const entry    = ctx?.entry ?? {};

  const [seed, setSeed] = useState<string | null>(null);

  useEffect(() => {
    setSubmitEnabled(false);
  }, []);

  const handleSeedChange = (s: string | null) => {
    setSeed(s);
    patch({ canvas_seed: s });
    setSubmitEnabled(!!s);
  };

  const handleSubmit = () => {
    if (!seed) return;
    onSubmit({ canvas_seed: seed });
  };

  const dice: number[] = Array.isArray(entry.dice) ? entry.dice : [];

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <Target className="w-4 h-4 text-red-400" />
        Бросок на атаку
      </div>

      {/* Контекст */}
      <div className="rounded border px-3 py-2 bg-zinc-950/30 text-sm space-y-0.5">
        <div>
          Цель: <span className="text-white/80">{asStr(entry.targetNpcName, '—')}</span>
        </div>
        <div>
          Оружие:{' '}
          <span className="text-white/80">
            {asStr(entry.weaponName, '—')} ({entry.weaponMode || '—'})
          </span>
        </div>
      </div>

      {/* Если броска ещё не было — рисуем seed */}
      {!dice.length ? (
        <>
          <CanvasSeed
            onChange={handleSeedChange}
            hint="Нарисуй, как ты атакуешь — рисунок определит бросок d6."
          />
          <button
            type="button"
            disabled={!seed}
            onClick={handleSubmit}
            className={`
              rounded border px-3 py-2 text-sm font-semibold
              ${seed
                ? 'border-red-400/70 text-red-200 hover:bg-red-500/10'
                : 'border-white/10 text-white/30 cursor-not-allowed'}
            `}
          >
            Бросить d6
          </button>
        </>
      ) : (
        <DiceRollDisplay
          dice={dice}
          total={dice[0]}
          rollLabel="Атака: 1d6"
          interpreter={gumshoeAttackInterpreter}
        />
      )}
    </div>
  );
}
