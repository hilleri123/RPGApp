'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';

type OutcomeKey = 'bad' | 'mixed' | 'good' | 'critical';

function normOutcome(x: any): OutcomeKey | null {
  const s = String(x ?? '').trim().toLowerCase();
  if (s === 'bad' || s === 'mixed' || s === 'good' || s === 'critical') return s;
  return null;
}

function outcomeRu(outcome: OutcomeKey | null): string {
  switch (outcome) {
    case 'bad':
      return 'Провал';
    case 'mixed':
      return 'Успех с последствиями';
    case 'good':
      return 'Успех';
    case 'critical':
      return 'Критический успех';
    default:
      return '—';
  }
}

function outcomeColor(outcome: OutcomeKey | null): string {
  switch (outcome) {
    case 'bad':
      return '#ff3333'; // красный
    case 'mixed':
      return '#facc15'; // жёлтый
    case 'good':
      return '#22c55e'; // зелёный
    case 'critical':
      return '#38bdf8'; // голубой
    default:
      return '#a1a1aa';
  }
}

const OUTCOME_POOL: OutcomeKey[] = ['bad', 'mixed', 'good', 'critical'];

function rollIconColor(n: number, sixMode: 'green' | 'blue'): string {
  if (n >= 1 && n <= 3) return '#ff3333';
  if (n === 4 || n === 5) return '#facc15';
  if (n === 6) return sixMode === 'blue' ? '#38bdf8' : '#22c55e';
  return '#a1a1aa';
}

function DiceIcon({ value, color, className }: { value: number; color: string; className?: string }) {
  const props = { className, style: { color } as React.CSSProperties };

  switch (value) {
    case 1:
      return <Dice1 {...props} />;
    case 2:
      return <Dice2 {...props} />;
    case 3:
      return <Dice3 {...props} />;
    case 4:
      return <Dice4 {...props} />;
    case 5:
      return <Dice5 {...props} />;
    case 6:
      return <Dice6 {...props} />;
    default:
      return <Dice3 {...props} />;
  }
}

export function MitigateStage({ wf, value, patch }: { wf: any; value: any; patch: (p: any) => void }) {
  const ctx = wf?.context ?? {};
  const roll = ctx.roll ?? {};

  const realRolls: number[] = useMemo(() => {
    if (!Array.isArray(roll.rolls)) return [];
    return roll.rolls
      .map((x: any) => Number(x))
      .filter((n: any) => Number.isFinite(n))
      .map((n: number) => Math.max(1, Math.min(6, Math.trunc(n))));
  }, [roll.rolls]);

  const realOutcome: OutcomeKey | null = useMemo(() => normOutcome(roll.outcome), [roll.outcome]);

  const [isRollingDice, setIsRollingDice] = useState(false);
  const [animatedRolls, setAnimatedRolls] = useState<number[]>([]);

  const [isRollingOutcome, setIsRollingOutcome] = useState(false);
  const [animatedOutcome, setAnimatedOutcome] = useState<OutcomeKey | null>(null);

  const animKey = useMemo(
    () => JSON.stringify({ outcome: roll.outcome ?? null, rolls: realRolls }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roll.outcome, realRolls.join(',')]
  );

  useEffect(() => {
    const hasAnything = (roll.outcome != null && String(roll.outcome) !== '') || realRolls.length > 0;
    if (!hasAnything) {
      setIsRollingDice(false);
      setAnimatedRolls([]);
      setIsRollingOutcome(false);
      setAnimatedOutcome(null);
      return;
    }

    setIsRollingOutcome(true);
    setAnimatedOutcome(realOutcome ?? 'mixed');

    setIsRollingDice(true);
    setAnimatedRolls(realRolls.length ? new Array(realRolls.length).fill(1) : []);

    const maxTicks = 15;
    let tick = 0;

    const id = setInterval(() => {
      tick += 1;

      if (tick >= maxTicks) {
        setAnimatedOutcome(realOutcome);
        setIsRollingOutcome(false);

        setAnimatedRolls(realRolls);
        setIsRollingDice(false);

        clearInterval(id);
        return;
      }

      setAnimatedOutcome(OUTCOME_POOL[Math.floor(Math.random() * OUTCOME_POOL.length)]!);

      setAnimatedRolls((prev) => {
        const len = realRolls.length || prev.length || 1;
        return new Array(len).fill(0).map(() => Math.floor(Math.random() * 6) + 1);
      });
    }, 55);

    return () => clearInterval(id); // cleanup интервалов в useEffect [web:10][web:42]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  const shownRolls = isRollingDice ? animatedRolls : realRolls;

  const shownOutcome = isRollingOutcome ? animatedOutcome : realOutcome;
  const canResist = isRollingOutcome || !(shownOutcome === 'good' || shownOutcome === 'critical');
  const shownOutcomeText = outcomeRu(shownOutcome);
  const shownOutcomeColor = outcomeColor(shownOutcome);

  // правило “если 6 много”: считаем по показанным (чтобы во время анимации тоже работало)
  const sixCount = shownRolls.reduce((acc, n) => acc + (n === 6 ? 1 : 0), 0);
  const sixMode: 'green' | 'blue' = sixCount >= 2 ? 'blue' : 'green';

  const isAccept = value?.choice === 'accept';
  const isResist = value?.choice === 'resist';

  const acceptStyle: React.CSSProperties = isAccept
    ? { outline: '4px solid #34d399', outlineOffset: 2, background: 'rgba(16,185,129,0.25)', borderColor: '#34d399' }
    : { outline: '0px solid transparent' };

  const resistStyle: React.CSSProperties = isResist
    ? { outline: '4px solid #f87171', outlineOffset: 2, background: 'rgba(239,68,68,0.25)', borderColor: '#f87171' }
    : { outline: '0px solid transparent' };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Последствия</div>

      <div className="flex flex-col gap-1">
        <div className="text-sm text-muted-foreground">Результат</div>

        <div className="flex items-center gap-3">
          <DiceIcon
            value={shownOutcome === 'critical' ? 6 : shownOutcome === 'good' ? 5 : shownOutcome === 'mixed' ? 4 : 1}
            color={shownOutcomeColor}
            className={`w-7 h-7 ${isRollingOutcome ? 'animate-bounce' : ''}`}
          />

          <span
            className={`text-xl font-bold drop-shadow-lg ${isRollingOutcome ? 'animate-bounce' : ''}`}
            style={{ color: shownOutcomeColor }}
          >
            {shownOutcomeText}
          </span>

          <span className="text-xs text-muted-foreground">({String(roll.outcome ?? '—')})</span>
        </div>
      </div>

      <div>
        <div className="text-sm text-muted-foreground">Кубики</div>

        {shownRolls.length ? (
          <div className="flex gap-3 flex-wrap mt-1">
            {shownRolls.map((n, idx) => {
              const color = rollIconColor(n, sixMode);
              return (
                <div key={idx} className="flex flex-col items-center">
                  <DiceIcon
                    value={n}
                    color={color}
                    className={`w-8 h-8 mb-1 ${isRollingDice ? 'animate-bounce' : ''}`}
                  />
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

      {ctx.consequence_hint ? (
        <div className="text-sm">
          <span className="text-muted-foreground">Hint:</span> {ctx.consequence_hint}
        </div>
      ) : null}

      <div className="flex flex-row gap-2">
        <button
          type="button"
          className="border-2 rounded px-3 py-2 text-sm font-semibold text-white flex-1"
          style={acceptStyle}
          onClick={() => patch({ choice: 'accept' })}
        >
          Принять последствия
        </button>

        {canResist ? (
          <button
            type="button"
            className="border-2 rounded px-3 py-2 text-sm font-semibold text-white flex-1"
            style={resistStyle}
            onClick={() => patch({ choice: 'resist' })}
          >
            Сопротивляться
          </button>
        ) : null}
      </div>



      <div className="text-xs text-muted-foreground">Submit отправит: {`{ choice: ${value?.choice}/"accept"|"resist" }`}.</div>
    </div>
  );
}
