'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import type { MoveResolutionViewModel } from './moveResolution';

function Section({
  title,
  text,
  defaultOpen = false,
  accent = 'text-white/70',
}: {
  title: string;
  text?: string | null;
  defaultOpen?: boolean;
  accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen, text]);

  if (!text) return null;

  return (
    <div className="rounded border border-white/10 bg-black/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className={`text-sm font-medium ${accent}`}>{title}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white/40" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 text-sm text-white/70 whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}

function isOutcomeOpen(kind: '10+' | '7-9' | '6-', outcome: string | null | undefined) {
  if (kind === '10+') return outcome === 'hit_10_plus';
  if (kind === '7-9') return outcome === 'hit_7_9';
  if (kind === '6-') return outcome === 'miss_6_minus' || outcome === 'miss';
  return false;
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
  const compactMeta = useMemo(() => {
    const parts: string[] = [];

    if (data.statId) parts.push(data.statId.toUpperCase());
    if (data.rollTotal !== null) parts.push(`бросок ${data.rollTotal}`);
    if (data.outcomeLabel && data.outcomeLabel !== '—') parts.push(data.outcomeLabel);

    return parts;
  }, [data.statId, data.rollTotal, data.outcomeLabel]);

  return (
    <div className={`rounded border border-white/10 bg-zinc-950/20 p-3 space-y-3 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
            <span className="text-sm text-white/70">{title}</span>
          </div>

          <div className="mt-1 text-base font-semibold text-white break-words">
            {data.moveTitle || '—'}
          </div>

          {compactMeta.length > 0 && (
            <div className="mt-1 text-xs text-white/45 flex flex-wrap gap-x-3 gap-y-1">
              {compactMeta.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.summary && (
        <div className="text-sm text-white/65 whitespace-pre-wrap">
          {data.summary}
        </div>
      )}

      {data.effect && (
        <div className="rounded border border-cyan-400/15 bg-cyan-500/5 px-3 py-2 text-sm text-white/80 whitespace-pre-wrap">
          {data.effect}
        </div>
      )}

      <Section
        title="Триггер"
        text={data.triggerText}
        defaultOpen={!data.outcome}
        accent="text-cyan-200"
      />

      <Section
        title="10+"
        text={data.effect10Plus}
        defaultOpen={isOutcomeOpen('10+', data.outcome)}
        accent={isOutcomeOpen('10+', data.outcome) ? 'text-emerald-300' : 'text-white/60'}
      />

      <Section
        title="7–9"
        text={data.effect79}
        defaultOpen={isOutcomeOpen('7-9', data.outcome)}
        accent={isOutcomeOpen('7-9', data.outcome) ? 'text-amber-300' : 'text-white/60'}
      />

      <Section
        title="6−"
        text={data.effect6Minus}
        defaultOpen={isOutcomeOpen('6-', data.outcome)}
        accent={isOutcomeOpen('6-', data.outcome) ? 'text-rose-300' : 'text-white/60'}
      />

      {data.resultText && (
        <div className="rounded border border-cyan-400/20 bg-cyan-500/5 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-cyan-300/80 mb-1">
            Выпавший результат
          </div>
          <div className="text-sm text-white/80 whitespace-pre-wrap">
            {data.resultText}
          </div>
        </div>
      )}
    </div>
  );
}