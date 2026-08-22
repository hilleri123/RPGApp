'use client';

import React from 'react';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';

export function clampDie(x: any): number | null {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(6, Math.trunc(n)));
}

export function rollIconColor(n: number, sixMode: 'green' | 'blue'): string {
  if (n >= 1 && n <= 3) return '#ff3333';
  if (n === 4 || n === 5) return '#facc15';
  if (n === 6) return sixMode === 'blue' ? '#38bdf8' : '#22c55e';
  return '#a1a1aa';
}

export function DiceIcon({ value, color, className }: { value: number; color: string; className?: string }) {
  const props = { className, style: { color } as React.CSSProperties };
  switch (value) {
    case 1: return <Dice1 {...props} />;
    case 2: return <Dice2 {...props} />;
    case 3: return <Dice3 {...props} />;
    case 4: return <Dice4 {...props} />;
    case 5: return <Dice5 {...props} />;
    case 6: return <Dice6 {...props} />;
    default: return <Dice3 {...props} />;
  }
}
