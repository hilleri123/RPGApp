'use client';

import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { POSITIONS, EFFECTS } from '../stageTypes';
import { ActionPositionEffectLine } from './_ui/BladesBadges';

const POSITION_META: Record<string, { label: string; color: string; desc: string }> = {
  controlled: { label: 'Controlled', color: '#22c55e', desc: 'Безопасно, меньше рисков.' },
  risky: { label: 'Risky', color: '#eab308', desc: 'Стандартный риск.' },
  desperate: { label: 'Desperate', color: '#ef4444', desc: 'Высокий риск, большие последствия.' },
};

const EFFECT_META: Record<string, { label: string; color: string; desc: string }> = {
  limited: { label: 'Limited', color: '#ef4444', desc: 'Мало прогресса/эффекта.' },
  standard: { label: 'Standard', color: '#eab308', desc: 'Нормальный эффект.' },
  great: { label: 'Great', color: '#22c55e', desc: 'Сильный эффект.' },
};

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs border"
      style={{ borderColor: color, color }}
    >
      <span className="inline-block w-2 h-2 rounded" style={{ background: color }} />
      {text}
    </span>
  );
}

function SelectCard({
  title,
  value,
  options,
  meta,
  onChange,
}: {
  title: string;
  value: string;
  options: readonly string[];
  meta: Record<string, { label: string; color: string; desc?: string }>;
  onChange: (v: string) => void;
}) {
  const selectedMeta = meta[value] ?? { label: String(value), color: '#a1a1aa', desc: '' };

  return (
    <div className="rounded border px-3 py-2 bg-zinc-950/20">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{title}</div>
        <Badge text={selectedMeta.label} color={selectedMeta.color} />
      </div>

      {selectedMeta.desc ? <div className="text-xs text-muted-foreground mt-1">{selectedMeta.desc}</div> : null}

      <div className="flex flex-row gap-2 mt-2">
        {options.map((opt) => {
          const m = meta[opt] ?? { label: opt, color: '#a1a1aa' };
          const selected = opt === value;

          const style: React.CSSProperties = selected
            ? {
                outline: `4px solid ${m.color}`,
                outlineOffset: 2,
                borderColor: m.color,
                background: 'rgba(255,255,255,0.04)',
              }
            : { borderColor: 'rgba(161,161,170,0.45)', background: 'transparent' };

          return (
            <button
              key={opt}
              type="button"
              className="border-2 rounded px-3 py-2 text-sm font-semibold text-white flex-1 transition-colors hover:bg-zinc-900/30"
              style={style}
              onClick={() => onChange(opt)}
              aria-pressed={selected}
            >
              <span style={{ color: m.color }}>{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GmSetPositionEffectStage({
  wf,
  value,
  patch,
}: {
  wf: any;
  value: any;
  patch: (p: any) => void;
}) {
  const position = value?.position ?? POSITIONS[1];
  const effect = value?.effect ?? EFFECTS[1];
  const consequence_hint = value?.consequence_hint ?? '';

  const selectedAction = wf?.context?.selectedAction;

  const posMeta = useMemo(
    () => POSITION_META[position] ?? { label: String(position), color: '#a1a1aa', desc: '' },
    [position]
  );
  const effMeta = useMemo(
    () => EFFECT_META[effect] ?? { label: String(effect), color: '#a1a1aa', desc: '' },
    [effect]
  );

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Мастер: position / effect</div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30">
        <ActionPositionEffectLine ctx={wf?.context ?? {}} />
      </div>

      <SelectCard
        title="Position"
        value={position}
        options={POSITIONS}
        meta={POSITION_META}
        onChange={(v) => patch({ position: v })}
      />

      <SelectCard
        title="Effect"
        value={effect}
        options={EFFECTS}
        meta={EFFECT_META}
        onChange={(v) => patch({ effect: v })}
      />

      <div className="rounded border px-3 py-2 bg-zinc-950/20">
        <div className="text-sm text-muted-foreground">Consequence hint (опц.)</div>
        <div className="text-xs text-muted-foreground mt-1">
          Коротко: что именно случится/какое последствие на столе, если будет mixed/bad.
        </div>
        <div className="mt-2">
          <Input value={consequence_hint} onChange={(e) => patch({ consequence_hint: e.target.value })} />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">Submit отправит: {'{ position, effect, consequence_hint }'}.</div>
    </div>
  );
}
