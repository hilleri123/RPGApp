// plugins/gumshoe/attack/stages/AttackDamageStage.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { CanvasSeed, DiceInterpreter, DiceRollDisplay } from '@/plugins/common/ui';
import { gumshoeAttackInterpreter } from './AttackRollStage';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

// Интерпретатор урона: просто показываем итог, без hit/miss
export const damageInterpreter: DiceInterpreter = ({ dice }) => {
  if (!dice.length) return { dieColors: [], outcome: null };
  return {
    dieColors: dice.map(() => 'neutral' as const),
    outcome: null, // текст результата придёт из entry.damage_text
  };
};

export function AttackDamageStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const wf: any  = action?.workflow ?? {};
  const ctx      = wf?.context ?? {};
  const entry    = ctx?.entry ?? {};

  const [seed, setSeed] = useState<string | null>(null);

  useEffect(() => {
    setSubmitEnabled(false);
  }, []);

  const handleSeedChange = (s: string | null) => {
    setSeed(s);
    patch({ damage_seed: s });
    setSubmitEnabled(!!s);
  };

  const handleSubmit = () => {
    if (!seed) return;
    onSubmit({ damage_seed: seed });
  };

  const damageRolls: number[] = Array.isArray(entry.damage_rolls) ? entry.damage_rolls : [];
  const alreadyRolled = damageRolls.length > 0 || entry.damage_total > 0;

  const pts = (entry?.skill_points ?? 0);
  const total = (entry?.dice?.[0] ?? 0) + pts;
  const animKey = `${entry?.canvas_seed ?? 'no-seed'}:${entry?.dice.join(',')}:${total}:${pts}`;

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <Zap className="w-4 h-4 text-orange-400" />
        Бросок на урон
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
        <DiceRollDisplay
          key={animKey}
          dice={entry?.dice}
          total={total}
          rollLabel={`1d6 + ${pts} pts`}
          interpreter={gumshoeAttackInterpreter}
          canvasSeed={entry?.canvas_seed ?? null}
          animKey={animKey}
        />
        {/* Напоминаем о попадании */}
        {entry.result_text && (
          <div className="text-green-300/70">{entry.result_text}</div>
        )}
      </div>

      {!alreadyRolled ? (
        <>
          <CanvasSeed
            onChange={handleSeedChange}
            hint="Нарисуй удар — рисунок определит урон."
          />
          <button
            type="button"
            disabled={!seed}
            onClick={handleSubmit}
            className={`
              rounded border px-3 py-2 text-sm font-semibold
              ${seed
                ? 'border-orange-400/70 text-orange-200 hover:bg-orange-500/10'
                : 'border-white/10 text-white/30 cursor-not-allowed'}
            `}
          >
            Бросить урон
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <DiceRollDisplay
            dice={damageRolls}
            total={entry.damage_total}
            rollLabel={`Урон: ${asStr(entry.weaponDamage, '?')}`}
            interpreter={damageInterpreter}
          />
          {entry.damage_text && (
            <div className="rounded border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-200">
              {entry.damage_text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
