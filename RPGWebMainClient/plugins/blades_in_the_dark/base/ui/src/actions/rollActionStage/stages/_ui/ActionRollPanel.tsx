'use client';

import React, { useMemo } from 'react';
import { DiceIcon, clampDie, rollIconColor } from './DiceUi';

type OutcomeKey = 'bad' | 'mixed' | 'good' | 'critical';

function normOutcome(x: any): OutcomeKey | null {
  const s = String(x ?? '').trim().toLowerCase();
  if (s === 'bad' || s === 'mixed' || s === 'good' || s === 'critical') return s;
  if (s === 'crit') return 'critical';
  return null;
}

function outcomeRu(outcome: OutcomeKey | null): string {
  switch (outcome) {
    case 'bad': return 'Провал';
    case 'mixed': return 'Успех с последствиями';
    case 'good': return 'Успех';
    case 'critical': return 'Критический успех';
    default: return '—';
  }
}

function outcomeColor(outcome: OutcomeKey | null): string {
  switch (outcome) {
    case 'bad': return '#ff3333';
    case 'mixed': return '#facc15';
    case 'good': return '#22c55e';
    case 'critical': return '#38bdf8';
    default: return '#a1a1aa';
  }
}

export function ActionRollPanel({ action }: { action: any }) {
  const wf: any = action?.workflow ?? {};
  const ctx = wf?.context ?? {};
  const roll = ctx?.roll ?? null;

  const rolls: number[] = useMemo(() => {
    const arr = Array.isArray(roll?.rolls) ? roll.rolls : [];
    return arr.map(clampDie).filter((x): x is number => x != null);
  }, [roll?.rolls]);

  const outcome: OutcomeKey | null = useMemo(() => normOutcome(roll?.outcome), [roll?.outcome]);
  const oc = outcomeColor(outcome);
  const outText = outcomeRu(outcome);

  const sixCount = rolls.reduce((acc, n) => acc + (n === 6 ? 1 : 0), 0);
  const sixMode: 'green' | 'blue' = sixCount >= 2 ? 'blue' : 'green';

  if (!roll) {
    return (
      <div className="rounded border p-3">
        <div className="font-medium">Бросок</div>
        <div className="text-sm text-muted-foreground mt-1">Пока нет результата броска.</div>
      </div>
    );
  }

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Бросок действия</div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30 flex flex-col gap-2">

        <div className="flex items-center gap-3">
          <DiceIcon
            value={outcome === 'critical' ? 6 : outcome === 'good' ? 5 : outcome === 'mixed' ? 4 : 1}
            color={oc}
            className="w-7 h-7"
          />
          <span className="text-xl font-bold drop-shadow-lg" style={{ color: oc }}>
            {outText}
          </span>
          <span className="text-xs text-muted-foreground">({String(roll?.outcome ?? '—')})</span>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Кубики</div>
          {rolls.length ? (
            <div className="flex gap-3 flex-wrap mt-1">
              {rolls.map((n, idx) => {
                const color = rollIconColor(n, sixMode);
                return (
                  <div key={idx} className="flex flex-col items-center">
                    <DiceIcon value={n} color={color} className="w-8 h-8 mb-1" />
                    <span className="text-2xl font-bold leading-none" style={{ color }}>
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm">—</div>
          )}
        </div>
      </div>
    </div>
  );
}
