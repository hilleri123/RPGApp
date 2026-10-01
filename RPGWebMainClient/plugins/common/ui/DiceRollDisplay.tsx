'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clampDie, DiceIcon } from './DiceUi';
import { ImageIcon } from 'lucide-react';

export type DieColor =
  | 'neutral'
  | 'bad'
  | 'mixed'
  | 'good'
  | 'critical';

export type DiceOutcome = {
  label: string;
  color: DieColor;
  effect?: string | null;
};

export type DiceInterpreter = (params: {
  dice: number[];
  total?: number | null;
}) => {
  dieColors: DieColor[];
  outcome: DiceOutcome | null;
};

const DIE_COLOR_HEX: Record<DieColor, string> = {
  neutral: '#a1a1aa',
  bad: '#ff3333',
  mixed: '#facc15',
  good: '#22c55e',
  critical: '#38bdf8',
};

const OUTCOME_BORDER: Record<DieColor, string> = {
  neutral: 'border-zinc-500/40',
  bad: 'border-red-500/40',
  mixed: 'border-yellow-500/40',
  good: 'border-green-500/40',
  critical: 'border-sky-500/40',
};

const OUTCOME_BG: Record<DieColor, string> = {
  neutral: 'bg-zinc-500/10',
  bad: 'bg-red-500/10',
  mixed: 'bg-yellow-500/10',
  good: 'bg-green-500/10',
  critical: 'bg-sky-500/10',
};

const OUTCOME_TEXT: Record<DieColor, string> = {
  neutral: 'text-zinc-300',
  bad: 'text-red-300',
  mixed: 'text-yellow-300',
  good: 'text-green-300',
  critical: 'text-sky-300',
};

const ANIM_STEPS = 10;
const ANIM_INTERVAL = 60;

function useAnimatedDice(finalDice: number[], animKey?: string) {
  const [displayDice, setDisplayDice] = useState<number[]>([]);
  const [animating, setAnimating] = useState(false);

  const diceKey = finalDice.join(',');
  const runKey = `${animKey ?? ''}|${diceKey}`;
  // Snapshot faces for this run — Strict Mode remounts must still land on finals.
  const finals = useMemo(() => [...finalDice], [diceKey]);

  useEffect(() => {
    if (!finals.length) {
      setDisplayDice([]);
      setAnimating(false);
      return;
    }

    let cancelled = false;
    let step = 0;
    // Do not gate on a prevKey ref: React Strict Mode cleans up the first
    // effect and remounts — an early return left a random face under the real total.
    setAnimating(true);
    setDisplayDice(finals.map(() => Math.ceil(Math.random() * 6)));

    const id = setInterval(() => {
      if (cancelled) return;
      step += 1;

      if (step >= ANIM_STEPS) {
        clearInterval(id);
        setDisplayDice(finals);
        setAnimating(false);
        return;
      }

      setDisplayDice(finals.map(() => Math.ceil(Math.random() * 6)));
    }, ANIM_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(id);
      // Snap to real faces so a cancelled spin never stays under the true total.
      setDisplayDice(finals);
      setAnimating(false);
    };
  }, [runKey, finals]);

  // Once the spin is over, always render authoritative faces (not a stale scramble).
  return { displayDice: animating ? displayDice : finals, animating };
}


export function SeedTooltip({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Посмотреть seed-рисунок"
        className={`
          flex items-center justify-center w-6 h-6 rounded
          border transition-colors
          ${open
            ? 'border-white/40 bg-white/10 text-white/80'
            : 'border-white/15 text-white/40 hover:border-white/30 hover:text-white/60'}
        `}
      >
        <ImageIcon className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-40 rounded border border-white/20 bg-zinc-900 p-1.5 shadow-xl">
          <div className="absolute -top-1.5 right-2 h-3 w-3 rotate-45 border-l border-t border-white/20 bg-zinc-900" />
          <img
            src={src}
            alt="Seed"
            className="w-full rounded object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
          <div className="mt-1 text-center text-xs text-white/30">seed-рисунок</div>
        </div>
      )}
    </div>
  );
}

type Props = {
  dice: number[];
  total?: number | null;
  rollLabel?: string;
  interpreter: DiceInterpreter;
  canvasSeed?: string | null;
  animKey?: string;
};

export function DiceRollDisplay({
  dice,
  total,
  rollLabel,
  interpreter,
  canvasSeed,
  animKey,
}: Props) {
  const validDice = useMemo(
    () => dice.map(clampDie).filter((x): x is number => x !== null),
    [dice]
  );

  const { displayDice, animating } = useAnimatedDice(validDice, animKey);
  const { dieColors, outcome } = interpreter({ dice: validDice, total });

  const displayColors: DieColor[] = animating
    ? displayDice.map(() => 'neutral')
    : dieColors;

  if (!validDice.length) {
    return (
      <div className="rounded border p-3 text-sm text-white/40">
        Пока нет результата броска.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!animating && outcome && (
        <div className={`
          flex items-start gap-2 rounded border px-3 py-2
          ${OUTCOME_BORDER[outcome.color]} ${OUTCOME_BG[outcome.color]}
          transition-opacity duration-300
        `}>
          <DiceIcon
            value={
              outcome.color === 'critical' ? 6
                : outcome.color === 'good' ? 5
                : outcome.color === 'mixed' ? 4
                : 1
            }
            color={DIE_COLOR_HEX[outcome.color]}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <div>
            <div className={`text-sm font-semibold ${OUTCOME_TEXT[outcome.color]}`}>
              {outcome.label}
            </div>
            {outcome.effect && (
              <div className="mt-0.5 text-xs text-white/60">{outcome.effect}</div>
            )}
          </div>
        </div>
      )}

      <div className="relative rounded border bg-zinc-950/30 px-3 py-2">
        {canvasSeed && (
          <div className="absolute right-2 top-2">
            <SeedTooltip src={canvasSeed} />
          </div>
        )}

        {rollLabel && (
          <div className="mb-2 flex items-baseline gap-2 pr-8 text-xs text-white/40">
            <span>{rollLabel}</span>
            {!animating && total != null && (
              <span className="text-sm font-semibold text-white">= {total}</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {displayDice.map((val, i) => {
            const color = DIE_COLOR_HEX[displayColors[i] ?? 'neutral'];
            return (
              <div
                key={`${animKey ?? 'dice'}-${i}`}
                className={`flex flex-col items-center transition-all duration-75 ${
                  animating ? 'scale-95 opacity-70' : 'scale-100 opacity-100'
                }`}
              >
                <DiceIcon value={val} color={color} className="mb-0.5 h-9 w-9" />
                <span
                  className="text-xl font-bold leading-none tabular-nums"
                  style={{ color }}
                >
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
