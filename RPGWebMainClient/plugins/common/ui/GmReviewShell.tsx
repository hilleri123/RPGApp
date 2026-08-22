'use client';

import React from 'react';
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react';

export type GmDecision = 'approve' | 'return' | 'reject';

type Props = {
  /** Чья это заявка (показываем если не GM) */
  isGm: boolean;

  /** Компонент заявки игрока — показываем и GM и игроку (readonly) */
  children: React.ReactNode;

  /** Дополнительные поля только для GM (переопределение, комментарий) */
  gmExtras?: React.ReactNode;

  /** Колбек решения */
  onDecision: (decision: GmDecision) => void;

  /** Лейблы кнопок (можно переопределить под систему) */
  labels?: {
    approve?: string;
    return?: string;
    reject?: string;
  };
};

export function GmReviewShell({
  isGm,
  children,
  gmExtras,
  onDecision,
  labels = {},
}: Props) {
  const {
    approve = 'Одобрить',
    return: ret = 'Вернуть игроку',
    reject = 'Отклонить',
  } = labels;

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Проверка заявки</div>

      {/* Заявка игрока — readonly-вью, одинаковое для обоих */}
      <div className="rounded border border-white/10 bg-zinc-950/20 p-3">
        {children}
      </div>

      {/* Доп. инструменты только для GM */}
      {isGm && gmExtras && (
        <div className="flex flex-col gap-2">
          {gmExtras}
        </div>
      )}

      {/* Кнопки решения — только GM */}
      {isGm ? (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            className="flex items-center gap-1.5 border-2 border-green-500/50 rounded px-3 py-2 text-sm font-semibold text-green-300"
            onClick={() => onDecision('approve')}
          >
            <CheckCircle className="w-4 h-4" />
            {approve}
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 border-2 border-yellow-500/50 rounded px-3 py-2 text-sm font-semibold text-yellow-300"
            onClick={() => onDecision('return')}
          >
            <RotateCcw className="w-4 h-4" />
            {ret}
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 border-2 border-red-500/50 rounded px-3 py-2 text-sm font-semibold text-red-300"
            onClick={() => onDecision('reject')}
          >
            <XCircle className="w-4 h-4" />
            {reject}
          </button>
        </div>
      ) : (
        <div className="text-sm text-white/40 italic">
          Ждём решения мастера…
        </div>
      )}
    </div>
  );
}
