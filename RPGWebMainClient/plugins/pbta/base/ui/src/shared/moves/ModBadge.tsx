'use client';

import { useMemo, useState } from 'react';

function rollChances(mod: number) {
  let miss = 0;
  let partial = 0;
  let hit = 0;
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      const r = d1 + d2 + mod;
      if (r >= 10) hit++;
      else if (r >= 7) partial++;
      else miss++;
    }
  }
  return {
    miss: Math.round((miss / 36) * 100),
    partial: Math.round((partial / 36) * 100),
    hit: Math.round((hit / 36) * 100),
  };
}

export function ModBadge({ mod, statValue }: { mod: number; statValue?: number }) {
  const [show, setShow] = useState(false);
  const chances = useMemo(() => rollChances(mod), [mod]);
  const label = mod >= 0 ? `+${mod}` : `${mod}`;
  const color =
    mod >= 2 ? 'text-emerald-400 border-emerald-600' :
    mod >= 0 ? 'text-blue-300 border-blue-700' :
    mod >= -1 ? 'text-yellow-400 border-yellow-700' :
    'text-red-400 border-red-700';

  return (
    <div className="relative inline-block shrink-0">
      <button
        type="button"
        className={`text-xs font-mono border rounded px-1.5 py-0.5 ${color} bg-black/40 cursor-pointer`}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow((v) => !v); }}
      >
        {label}
      </button>
      {show && (
        <div className="absolute z-50 bottom-full mb-1 left-1/2 -translate-x-1/2 w-44 rounded border border-gray-700 bg-gray-950 shadow-xl p-2 text-xs text-gray-200 space-y-1">
          <div className="font-semibold text-gray-100 mb-1 text-center">2d6{label}</div>
          <div className="flex justify-between">
            <span className="text-emerald-400">10+</span>
            <span className="font-mono">{chances.hit}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-yellow-400">7–9</span>
            <span className="font-mono">{chances.partial}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-red-400">6−</span>
            <span className="font-mono">{chances.miss}%</span>
          </div>
          {statValue != null && (
            <div className="border-t border-gray-800 pt-1 text-gray-500 text-center">
              стат: {statValue}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ModBadgeRow({
  statScores,
}: {
  statScores: Array<{ sid: string; mod: number; score?: number }>;
}) {
  if (!statScores.length) return null;
  if (statScores.length === 1) {
    return <ModBadge mod={statScores[0].mod} statValue={statScores[0].score} />;
  }
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {statScores.map((s) => (
        <div
          key={s.sid}
          className="text-[10px] font-mono border rounded px-1 py-0.5 text-gray-300 border-gray-700 bg-black/40"
        >
          {s.sid}:{s.mod >= 0 ? `+${s.mod}` : s.mod}
        </div>
      ))}
    </div>
  );
}
