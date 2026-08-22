'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { MoveExpandableProps } from './types';
import { MoveBrief } from './MoveBrief';
import { outcomeAccent, outcomeLabel } from './utils';
import {
  missingChoiceHint,
  missingRequiredPlaceholders,
  resolveMoveField,
} from './placeholders';

function DetailBlock({
  title,
  text,
  accent = 'text-gray-500',
  open = false,
}: {
  title: string;
  text?: string | null;
  accent?: string;
  open?: boolean;
}) {
  if (!text) return null;
  return (
    <div className={open ? 'rounded border border-white/10 bg-black/20 px-2 py-1.5' : ''}>
      <div className={`text-[10px] uppercase tracking-wide mb-0.5 ${accent}`}>{title}</div>
      <div className="text-xs text-gray-300 whitespace-pre-line">{text}</div>
    </div>
  );
}

export function MoveExpandable({
  move,
  statScores = [],
  skills = [],
  playbookTitle,
  hideModBadge = false,
  checked,
  isStarting,
  disabled = false,
  disabledHint,
  highlighted,
  defaultExpanded = false,
  expanded,
  onExpandedChange,
  onToggle,
  outcome,
  resultText,
  showRollOutcomes = true,
  className,
  placeholders,
  picks,
  displayMode = 'view',
  movesMap,
  placeholderEditor,
  textSheetEditing = false,
  onTextSheetEdit,
  tierBadge,
}: MoveExpandableProps) {
  const [internalOpen, setInternalOpen] = useState(defaultExpanded);
  const isControlled = expanded !== undefined;
  const open = isControlled ? expanded : internalOpen;

  useEffect(() => {
    if (!isControlled) setInternalOpen(defaultExpanded);
  }, [defaultExpanded, isControlled]);

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onExpandedChange?.(next);
  };

  const clickable = !!onToggle && !disabled;
  const borderClass = checked || highlighted
    ? 'border-indigo-600 bg-indigo-950/40'
    : 'border-gray-700 bg-black/20';

  const isOpen10 = outcome === 'hit_10_plus';
  const isOpen79 = outcome === 'hit_7_9';
  const isOpen6 = outcome === 'miss_6_minus';
  const outcomeTag = outcomeLabel(outcome);

  const hasRollOutcomes = showRollOutcomes && (
    move.effect_10_plus || move.effect_7_9 || move.effect_6_minus
  );

  const resolveText = (text?: string | null) => {
    if (!text || !(placeholders?.length)) return text ?? undefined;
    return resolveMoveField(text, placeholders, picks, movesMap);
  };

  const missing = missingRequiredPlaceholders(placeholders, picks);
  const choiceHint = displayMode === 'view' ? missingChoiceHint(missing) : null;

  const triggerText = resolveText(move.trigger);
  const effectText = resolveText(move.effect);
  const text10 = resolveText(move.effect_10_plus);
  const text79 = resolveText(move.effect_7_9);
  const text6 = resolveText(move.effect_6_minus);

  const sheetTextEditMode = displayMode === 'edit' && !!onTextSheetEdit && textSheetEditing;
  const showSheetViewText = open && !(displayMode === 'edit' && onTextSheetEdit && sheetTextEditMode);
  const showSheetEditor = open && sheetTextEditMode && placeholderEditor;

  return (
    <div
      className={`
        rounded border transition-colors
        ${borderClass}
        ${disabled ? 'opacity-50' : ''}
        ${className ?? ''}
      `}
    >
      <div className={`flex items-stretch gap-0 select-none ${clickable ? '' : ''}`}>
        {onToggle && (
          <label
            className="flex items-center px-2 shrink-0 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={!!checked}
              disabled={disabled || isStarting}
              onChange={(e) => onToggle(e.target.checked)}
              className="shrink-0 accent-indigo-500"
            />
          </label>
        )}

        <div className="flex-1 min-w-0">
          <MoveBrief
            move={move}
            statScores={statScores}
            skills={skills}
            playbookTitle={playbookTitle}
            hideModBadge={hideModBadge}
            checked={checked}
            isStarting={isStarting}
            disabled={disabled}
            disabledHint={disabledHint}
            highlighted={highlighted}
            tierBadge={tierBadge}
            onHeaderClick={() => setOpen(!open)}
            trailing={(
              <div className="flex items-center gap-0.5 shrink-0 self-center">
                {displayMode === 'edit' && onTextSheetEdit && (
                  <button
                    type="button"
                    title={textSheetEditing ? 'Закончить редактирование' : 'Редактировать текст хода'}
                    aria-label={textSheetEditing ? 'Закончить редактирование' : 'Редактировать текст хода'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTextSheetEdit();
                    }}
                    className={`
                      p-1 rounded border transition-colors
                      ${textSheetEditing
                        ? 'border-indigo-500 bg-indigo-950/50 text-indigo-300'
                        : 'border-gray-600 bg-black/30 text-gray-400 hover:border-gray-400 hover:text-gray-200'}
                    `}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="text-gray-500 text-xs ml-0.5">
                  {open ? '▲' : '▼'}
                </span>
              </div>
            )}
          />
        </div>
      </div>

      {open && (
        <div
          className="px-3 pb-3 space-y-2 border-t border-gray-800 pt-2 select-text"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {showSheetViewText && outcomeTag && (
            <div className={`text-[10px] uppercase tracking-wide ${outcomeAccent(outcome)}`}>
              Исход броска: {outcomeTag}
            </div>
          )}

          {showSheetViewText && triggerText && (
            <DetailBlock title="Когда..." text={triggerText} accent="text-cyan-400/80" open />
          )}

          {showSheetViewText && effectText && (
            <DetailBlock title="Эффект" text={effectText} accent="text-gray-500" open />
          )}

          {showSheetViewText && choiceHint && (
            <div className="text-xs text-amber-300/90 border border-amber-900/40 bg-amber-950/20 rounded px-2 py-1">
              {choiceHint}
            </div>
          )}

          {showSheetEditor}

          {showSheetViewText && hasRollOutcomes && (
            <div className="space-y-2">
              <DetailBlock
                title="10+"
                text={text10}
                accent={isOpen10 ? 'text-emerald-300' : 'text-gray-500'}
                open={isOpen10}
              />
              <DetailBlock
                title="7–9"
                text={text79}
                accent={isOpen79 ? 'text-amber-300' : 'text-gray-500'}
                open={isOpen79}
              />
              <DetailBlock
                title="6−"
                text={text6}
                accent={isOpen6 ? 'text-rose-300' : 'text-gray-500'}
                open={isOpen6}
              />
            </div>
          )}

          {showSheetViewText && resultText && (
            <div className="rounded border border-cyan-400/20 bg-cyan-500/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-cyan-300/80 mb-1">
                Результат броска
              </div>
              <div className={`text-sm font-mono whitespace-pre-wrap ${outcomeAccent(outcome)}`}>
                {resultText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
