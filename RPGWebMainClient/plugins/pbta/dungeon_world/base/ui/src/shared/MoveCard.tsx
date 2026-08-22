'use client';

export {
  MoveBrief,
  MoveExpandable,
  MoveExpandable as MoveCard,
  ModBadge,
  ModBadgeRow,
  toMoveDisplayData,
  moveKindLabel,
} from '../../../../../base/ui/src/shared/moves';

import type { Move } from '../types/character';

export function DWMoveTooltip({ move, isBasic }: { move: Move; isBasic: boolean }) {
  const hasRoll = (move.available_stats?.length ?? 0) > 0;

  return (
    <div className="w-72 rounded border border-gray-700 bg-gray-950 shadow-xl p-3 space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-100">{move.title}</span>
        {isBasic && (
          <span className="text-[9px] uppercase text-emerald-600 border border-emerald-800 rounded px-1">
            базовый
          </span>
        )}
      </div>

      {move.trigger && (
        <div className="text-gray-400 italic">«{move.trigger}»</div>
      )}

      {(move.available_stats?.length ?? 0) > 1 && (
        <div className="text-indigo-400 text-[10px]">
          ⤷ Выбор стата: {move.available_stats.join(' / ').toUpperCase()}
        </div>
      )}

      {move.effect && (
        <div className="text-gray-300">{move.effect}</div>
      )}

      {hasRoll && (
        <>
          {move.effect_10_plus && (
            <div>
              <span className="text-emerald-400 font-semibold">10+ </span>
              <span className="text-gray-300">{move.effect_10_plus}</span>
            </div>
          )}
          {move.effect_7_9 && (
            <div>
              <span className="text-yellow-400 font-semibold">7–9 </span>
              <span className="text-gray-300">{move.effect_7_9}</span>
            </div>
          )}
          {move.effect_6_minus && (
            <div>
              <span className="text-red-400 font-semibold">6− </span>
              <span className="text-gray-300">{move.effect_6_minus}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
