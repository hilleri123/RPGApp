'use client';

import React from 'react';
import { EntitySquare, type EntitySquareProps } from './EntitySquare';

export type TurnOrderItem = Pick<EntitySquareProps, 'name' | 'kind' | 'iconUrl' | 'color' | 'isEnemy' | 'isDead'> & {
  id: string;
  /** Место в очереди (с 1). Без него номер не рисуется — участник вне очереди. */
  position?: number;
  /** Сейчас его ход. */
  active?: boolean;
  /** Выделить рамкой (например, тот, кто делает ход). */
  marked?: boolean;
  /** Значение инициативы и т.п. — бейдж справа внизу. */
  value?: number | string | null;
  /** Короткая метка справа вверху (число заявок и т.п.). */
  badge?: string | null;
  /** Сущности нет в сцене (устарела запись в очереди). */
  missing?: boolean;
  disabled?: boolean;
};

/**
 * Участники слева направо: квадрат сущности (как в списках сцены), подпись снизу.
 * Общий для всех плагинов: очередь ходов, выбор цели заявки и т.п.
 * Без `onSelect` — только просмотр.
 */
export function TurnOrderStrip({
  items,
  onSelect,
  wrap = false,
}: {
  items: TurnOrderItem[];
  onSelect?: (id: string) => void;
  /** Переносить участников на новую строку вместо прокрутки. */
  wrap?: boolean;
}) {
  return (
    <ol className={`flex items-start gap-3 pb-2 pt-1 pr-2 ${wrap ? 'flex-wrap' : 'overflow-x-auto'}`}>
      {items.map((it) => {
        // Выбранный участник — бирюзовая рамка; чей сейчас ход — розовое свечение.
        // Если это один и тот же участник, видны оба признака.
        const glow = 'shadow-[0_0_12px_rgba(244,63,94,0.55)]';
        const ring =
          it.active && it.marked
            ? `ring-2 ring-cyan-400 ${glow}`
            : it.active
              ? `ring-2 ring-rose-400 ${glow}`
              : it.marked
                ? 'ring-2 ring-cyan-400/70'
                : '';
        const square = (
          <div className="relative">
            <EntitySquare
              name={it.name}
              kind={it.kind}
              iconUrl={it.iconUrl}
              color={it.color}
              isEnemy={it.isEnemy}
              isDead={it.isDead}
              showName={false}
              className={ring}
            />
            {it.position != null ? (
              <span className="absolute -left-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] tabular-nums text-gray-400 ring-1 ring-gray-700">
                {it.position}
              </span>
            ) : null}
            {it.badge ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-600 px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-gray-900">
                {it.badge}
              </span>
            ) : null}
            {it.value != null ? (
              <span className="absolute -bottom-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[11px] font-semibold tabular-nums text-white ring-2 ring-gray-900">
                {it.value}
              </span>
            ) : null}
          </div>
        );
        const caption = (
          <>
            <span
              className={`w-full truncate text-center text-[11px] leading-tight ${
                it.active ? 'font-medium text-rose-100' : 'text-gray-300'
              }`}
            >
              {it.name}
            </span>
            {it.active ? <span className="text-[10px] text-rose-300">ход</span> : null}
          </>
        );
        const cls = `flex w-16 shrink-0 flex-col items-center gap-1 ${it.missing ? 'opacity-50' : ''}`;
        const title = it.missing ? 'Нет в сцене' : `${it.name}${it.value != null ? ` · ${it.value}` : ''}`;

        return (
          <li key={it.id} title={title}>
            {onSelect ? (
              <button
                type="button"
                disabled={it.disabled}
                onClick={() => onSelect(it.id)}
                className={`${cls} rounded transition-transform enabled:hover:scale-105 disabled:opacity-50`}
              >
                {square}
                {caption}
              </button>
            ) : (
              <div className={cls}>
                {square}
                {caption}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
