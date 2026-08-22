'use client';

import React from 'react';
import type { ActionWizardState } from './actionWizard';

type Props = {
  wizard: ActionWizardState | null;
  viewKey: string;
  onViewKeyChange: (key: string) => void;
};

export function ActionWizardNav({ wizard, viewKey, onViewKeyChange }: Props) {
  const steps = wizard?.steps ?? [];
  if (steps.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-zinc-700/80 bg-zinc-950/40 shrink-0">
      {steps.map((step, idx) => {
        const active = step.key === viewKey;
        const disabled = !!step.disabled;
        const readonly = !!step.readonly;
        return (
          <button
            key={step.key}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onViewKeyChange(step.key)}
            className={`
              text-xs px-2.5 py-1 rounded-full border transition-colors
              ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
              ${active
                ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100'
                : 'border-white/10 bg-zinc-900/60 text-white/50 hover:text-white/80 hover:border-white/20'}
              ${readonly && !disabled ? 'opacity-80' : ''}
            `}
            title={
              disabled ? 'Ещё не доступно' : readonly ? 'Только просмотр' : undefined
            }
          >
            <span className="text-white/30 mr-1">{idx + 1}.</span>
            {step.label}
            {readonly && !disabled && <span className="ml-1 text-white/25">🔒</span>}
          </button>
        );
      })}
    </div>
  );
}
