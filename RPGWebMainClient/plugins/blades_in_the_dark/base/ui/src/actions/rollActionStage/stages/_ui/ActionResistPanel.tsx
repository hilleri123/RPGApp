'use client';

import React, { useMemo } from 'react';
import type { AttributeId } from '../../../../types';
import { ATTR_RU } from '../../../../i18n';
import { DiceIcon, clampDie, rollIconColor } from './DiceUi';

export function ActionResistPanel({ action }: { action: any }) {
  const wf: any = action?.workflow ?? {};
  const ctx = wf?.context ?? {};
  const resist = ctx?.resist ?? null;

  const rolls: number[] = useMemo(() => {
    const arr = Array.isArray(resist?.rolls) ? resist.rolls : [];
    return arr.map(clampDie).filter((x): x is number => x != null);
  }, [resist?.rolls]);

  const sixCount = rolls.reduce((acc, n) => acc + (n === 6 ? 1 : 0), 0);
  const sixMode: 'green' | 'blue' = sixCount >= 2 ? 'blue' : 'green';

  if (!resist) {
    return (
      <div className="rounded border p-3">
        <div className="font-medium">Сопротивление</div>
        <div className="text-sm text-muted-foreground mt-1">Сопротивление не выполнялось (или ещё не завершено).</div>
      </div>
    );
  }

  const attr = (resist?.attribute ?? 'insight') as AttributeId;

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Сопротивление</div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30 flex flex-col gap-2">
        <div className="text-sm">
          <span className="text-muted-foreground">Атрибут:</span>{' '}
          <span className="font-semibold text-white">{ATTR_RU[attr] ?? String(attr)}</span>
          <span className="gap-4">|</span>
          <span className="text-muted-foreground">Стоимость стресса:</span>{' '}
          <span className="font-semibold text-white">{String(resist?.stressCost ?? '—')}</span>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Кубики</div>
          {rolls.length ? (
            <div className="flex gap-3 flex-wrap mt-1">
              {rolls.map((n, idx) => {
                const color = rollIconColor(n, sixMode);
                return (
                  <div key={idx} className="flex flex-col items-center">
                    <DiceIcon value={n} color={color} className="w-7 h-7 mb-1" />
                    <span className="text-xl font-bold leading-none" style={{ color }}>
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
