'use client';

import React from 'react';
import { ActionSummaryCarousel } from './_ui/ActionSummaryCarousel';

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

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Итог (мастер)</div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30 flex flex-col gap-2">
        <ActionSummaryCarousel action={action} />
      </div>

      {/* (опционально) компактная строка для отладки/контекста */}
      <div className="text-xs text-muted-foreground">
        {roll?.character_name ? `${roll.character_name}: ` : ''}
        {String(roll?.action ?? '—')} · outcome: {String(roll?.outcome ?? '—')}
        {resist ? ` · resist: ${String(resist?.attribute ?? '—')} (${String(resist?.stressCost ?? '—')})` : ''}
      </div>

      <input
        className="border rounded px-2 py-1 text-black bg-background"
        placeholder="trauma (optional)"
        value={value?.trauma ?? ''}
        onChange={(e) => patch({ trauma: e.target.value || null })}
      />

      <textarea
        className="border rounded px-2 py-1 text-black bg-background"
        placeholder="summary (optional)"
        rows={4}
        value={value?.summary ?? ''}
        onChange={(e) => patch({ summary: e.target.value || null })}
      />

      <div className="text-xs text-muted-foreground">Submit отправит: {'{ trauma?, summary? }'}.</div>
    </div>
  );
}
