'use client';

import React from 'react';
import { ActionSummaryCarousel } from './_ui/ActionSummaryCarousel'; // тот, который мы сделали
// или если ты хочешь только badges+roll+resist - оставь как есть

export function CompletedSummaryStage({ action }: { action: any }) {
  const wf: any = action?.workflow ?? {};
  const ctx = wf?.context ?? {};
  const roll = ctx?.roll ?? null;

  const summary = ctx?.summary ?? null;
  const trauma = ctx?.trauma ?? null;

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">Завершено</div>
        <div className="text-xs text-muted-foreground">
          {roll?.character_name ? `${roll.character_name}` : '—'} · {String(roll?.action ?? '—')}
        </div>
      </div>

      <ActionSummaryCarousel action={action} />

      {(trauma || summary) ? (
        <div className="rounded border px-3 py-2 bg-zinc-950/30 flex flex-col gap-2">
          {trauma ? (
            <div className="text-sm">
              <span className="text-muted-foreground">Trauma:</span>{' '}
              <span className="text-white font-semibold">{String(trauma)}</span>
            </div>
          ) : null}

          {summary ? (
            <div className="text-sm whitespace-pre-wrap">
              <span className="text-muted-foreground">Summary:</span> {String(summary)}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Итог мастер не заполнил.</div>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Итог мастер не заполнил.</div>
      )}
    </div>
  );
}
