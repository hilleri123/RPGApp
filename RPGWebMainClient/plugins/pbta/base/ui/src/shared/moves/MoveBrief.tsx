'use client';

import type { MoveBriefProps } from './types';
import { moveKindLabel, statChipStyle } from './utils';
import { ModBadgeRow } from './ModBadge';

export function MoveBrief({
  move,
  statScores = [],
  skills = [],
  playbookTitle,
  hideModBadge = false,
  checked,
  isStarting,
  disabled = false,
  disabledHint,
  highlighted = false,
  trailing,
  tierBadge,
  onHeaderClick,
  className,
}: MoveBriefProps) {
  const kindLabel = moveKindLabel(move, playbookTitle);
  const primaryStatId = move.available_stats?.[0];
  const chipStyle = statChipStyle(skills, primaryStatId);

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 min-w-0
        ${onHeaderClick ? 'cursor-pointer' : ''}
        ${className ?? ''}
      `}
      onClick={onHeaderClick}
      role={onHeaderClick ? 'button' : undefined}
    >
      {isStarting && (
        <span className="text-[9px] text-indigo-400 shrink-0" title="Стартовый ход">★</span>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold truncate ${highlighted || checked ? 'text-gray-100' : 'text-gray-200'}`}>
            {move.title}
          </span>
          <span className="text-[10px] bg-gray-800 text-gray-300 border border-gray-700 rounded px-1 shrink-0">
            {kindLabel}
          </span>
          {tierBadge ? (
            <span className="text-[10px] text-gray-500 border border-gray-700 rounded px-1 shrink-0">
              {tierBadge}
            </span>
          ) : null}

          {(move.available_stats?.length ?? 0) > 0 && (
            <span
              className="text-[10px] text-gray-100 font-mono px-1 rounded-full border shrink-0"
              style={chipStyle}
            >
              {move.available_stats!.join(' / ')}
            </span>
          )}

          {disabled && (
            <span className="text-[10px] text-yellow-300 border border-yellow-800 bg-yellow-950/30 rounded px-1 shrink-0">
              locked
            </span>
          )}
        </div>

        {move.summary && (
          <div className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{move.summary}</div>
        )}

        {move.trigger && !move.summary && (
          <div className="text-[11px] text-gray-500 italic line-clamp-2 mt-0.5">{move.trigger}</div>
        )}

        {disabledHint && (
          <div className="text-[10px] text-yellow-300 mt-0.5">{disabledHint}</div>
        )}
      </div>

      {!hideModBadge && <ModBadgeRow statScores={statScores} />}

      {trailing}
    </div>
  );
}
