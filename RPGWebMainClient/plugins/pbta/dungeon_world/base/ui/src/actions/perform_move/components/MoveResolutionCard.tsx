'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { DiceRollDisplay, type DiceInterpreter } from 'plugins/common/ui';
import { pbtaRollInterpreter } from 'plugins/pbta/base/ui/src/actions/perform_move/stages/PerformMoveRollStage';
import type { MoveResolutionViewModel } from './moveResolution';

const quietInterpreter: DiceInterpreter = (params) => ({
  dieColors: pbtaRollInterpreter(params).dieColors,
  outcome: null,
});

function TextBlock({ title, text, accent = 'text-white/70' }: { title: string; text?: string | null; accent?: string }) {
  if (!text) return null;
  return (
    <div className="rounded border border-white/10 bg-black/10 px-3 py-2">
      <div className={`text-xs uppercase tracking-wide mb-1 ${accent}`}>{title}</div>
      <div className="text-sm text-white/75 whitespace-pre-wrap">{text}</div>
    </div>
  );
}

function signed(value: number | null): string | null {
  if (value === null || value === 0) return null;
  return `${value > 0 ? '+' : ''}${value}`;
}

export function MoveResolutionCard({
  data,
  title = 'Результат хода',
  className = '',
}: {
  data: MoveResolutionViewModel;
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const isPartial = data.outcome === 'hit_7_9';
  const isMiss = data.outcome === 'miss_6_minus' || data.outcome === 'miss';
  const rolledText = isPartial ? data.effect79 : isMiss ? data.effect6Minus : null;

  const rollBits = [
    data.statId ? data.statId.toUpperCase() : null,
    data.statValue !== null ? String(data.statValue) : null,
    signed(data.baseModifier),
    signed(data.localBonus),
    signed(data.aidBonus),
    data.rollTotal !== null ? `= ${data.rollTotal}` : null,
  ].filter(Boolean);

  return (
    <div className={`rounded border border-white/10 bg-zinc-950/20 p-3 space-y-2 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
            <span className="text-sm text-white/70">{title}</span>
          </div>
          <div className="mt-1 text-base font-semibold text-white break-words">
            {data.moveTitle || '—'}
          </div>
          {data.outcomeLabel && data.outcomeLabel !== '—' && (
            <div className="mt-0.5 text-xs text-white/50">{data.outcomeLabel}</div>
          )}
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-xs text-white/50">
          {open ? 'Свернуть' : 'Раскрыть'}
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      {!open && isPartial && (rolledText || data.choices.length > 0) && (
        <div className="rounded border border-amber-400/25 bg-amber-500/5 px-3 py-2 space-y-2">
          <div className="text-xs uppercase tracking-wide text-amber-300/80">Выборы на 7–9</div>
          {rolledText && (
            <div className="text-sm text-white/80 whitespace-pre-wrap">{rolledText}</div>
          )}
          {data.choices.map((choice) => (
            <div key={choice.id || choice.prompt} className="text-sm text-white/75">
              {choice.prompt && <div className="text-white/55">{choice.prompt}</div>}
              {choice.options.length > 0 && (
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {choice.options.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {!open && isMiss && rolledText && (
        <div className="text-sm text-white/75 whitespace-pre-wrap">{rolledText}</div>
      )}

      {open && (
        <div className="space-y-2">
          {rollBits.length > 0 && (
            <div className="text-xs font-mono text-white/55">{rollBits.join(' ')}</div>
          )}
          <TextBlock title="Кратко" text={data.summary} />
          <TextBlock title="Эффект" text={data.effect} />
          <TextBlock title="Триггер" text={data.triggerText} accent="text-cyan-200" />
          <TextBlock title="10+" text={data.effect10Plus} accent="text-emerald-300" />
          <TextBlock title="7–9" text={data.effect79} accent="text-amber-300" />
          {data.choices.map((choice) => (
            <div key={`open-${choice.id || choice.prompt}`} className="text-sm text-white/70">
              {choice.prompt}
              {choice.options.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {choice.options.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <TextBlock title="6−" text={data.effect6Minus} accent="text-rose-300" />
          <TextBlock title="Выпавший результат" text={data.resultText} accent="text-cyan-300" />
        </div>
      )}

      {data.dice.length > 0 && (
        <DiceRollDisplay
          dice={data.dice}
          total={data.rollTotal}
          rollLabel="2d6"
          interpreter={quietInterpreter}
          canvasSeed={data.rollSeed}
          animKey={data.dice.join(',')}
        />
      )}
    </div>
  );
}
