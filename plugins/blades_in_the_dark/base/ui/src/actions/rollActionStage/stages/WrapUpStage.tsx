'use client';

import React from 'react';
import { ActionSummaryCarousel } from './_ui/ActionSummaryCarousel';
import { TRAUMA_OPTIONS } from '../../../i18n';

export function WrapUpStage({
  action,
  value,
  patch,
}: {
  action: any;
  value: any;
  patch: (p: any) => void;
}) {
  const wf: any = action?.workflow ?? {};
  const ctx = wf?.context ?? {};
  const roll = ctx?.roll ?? {};
  const resist = ctx?.resist ?? null;

  const needsTrauma = !!ctx?.needsTrauma;

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Итог (мастер)</div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30 flex flex-col gap-2">
        <ActionSummaryCarousel action={action} />
      </div>

      <div className="text-xs text-muted-foreground">
        {roll?.character_name ? `${roll.character_name}: ` : ''}
        {String(roll?.action ?? '—')} · outcome: {String(roll?.outcome ?? '—')}
        {resist ? ` · resist: ${String(resist?.attribute ?? '—')} (${String(resist?.stressCost ?? '—')})` : ''}
      </div>

      {needsTrauma ? (
        <div className="flex flex-col gap-1">
          <div className="text-sm text-muted-foreground">Новая травма (обязательно)</div>
          <select
            className="border rounded text-black px-2 py-1 bg-background"
            value={value?.trauma ?? ''}
            onChange={(e) => patch({ trauma: e.target.value || null })}
          >
            <option value="">— выбери trauma —</option>
            {TRAUMA_OPTIONS.map((t) => (
              <option key={t.value} value={t.value} title={t.desc}>
                {t.label}
              </option>
            ))}
          </select>

          {ctx?.traumaCharacterId ? (
            <div className="text-xs text-muted-foreground">Кому: {String(ctx.traumaCharacterId)}</div>
          ) : null}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          Травма не требуется (stress не достиг максимума).
        </div>
      )}

      <textarea
        className="border rounded px-2 py-1 bg-background"
        placeholder="summary (optional)"
        rows={4}
        value={value?.summary ?? ''}
        onChange={(e) => patch({ summary: e.target.value || null })}
      />

      <div className="text-xs text-muted-foreground">Submit отправит: {'{ trauma?, summary? }'}.</div>
    </div>
  );
}
