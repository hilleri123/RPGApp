'use client';

import React from 'react';

export function AssistConfirmStage({ wf, value, patch }: { wf: any; value: any; patch: (p: any) => void }) {
  const ctx = wf?.context ?? {};
  const accept: boolean | null = typeof value?.accept_help === 'boolean' ? value.accept_help : null;

  const baseBtn =
    'border-2 rounded px-3 py-2 text-sm font-semibold transition-colors text-white flex-1 ' +
    'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2';

  const yesStyle: React.CSSProperties =
    accept === true
      ? { outline: '4px solid #34d399', outlineOffset: 2, background: 'rgba(16,185,129,0.22)', borderColor: '#34d399' }
      : { outline: '0px solid transparent', background: 'transparent', borderColor: 'rgba(161,161,170,0.45)' };

  const noStyle: React.CSSProperties =
    accept === false
      ? { outline: '4px solid #f87171', outlineOffset: 2, background: 'rgba(239,68,68,0.18)', borderColor: '#f87171' }
      : { outline: '0px solid transparent', background: 'transparent', borderColor: 'rgba(161,161,170,0.45)' };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Помощь союзнику</div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30">
        <div className="text-sm text-muted-foreground">Тебя просят помочь в действии:</div>
        <div className="text-sm font-semibold text-white">{ctx.selectedAction ?? '—'}</div>
      </div>

      <div className="flex flex-row gap-2">
        <button
          type="button"
          aria-pressed={accept === true}
          className={baseBtn}
          style={yesStyle}
          onClick={() => patch({ accept_help: true })}
        >
          Помогаю
        </button>

        <button
          type="button"
          aria-pressed={accept === false}
          className={baseBtn}
          style={noStyle}
          onClick={() => patch({ accept_help: false })}
        >
          Отказываюсь
        </button>
      </div>

      <div className="text-xs text-muted-foreground">Submit отправит: {'{ accept_help: true|false }'}.</div>
    </div>
  );
}
