'use client';
import React, { useMemo } from 'react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function RollInitiativeTieRollStage({
  user_id,
  action,
  value,
  patch,
  onSubmit,
}: any) {
  const wf: any = action?.workflow ?? {};
  const ctx =
    (wf?.stageData && Object.keys(wf.stageData ?? {}).length ? wf.stageData : null) ??
    wf?.context ??
    {};

  const order: any[] = Array.isArray(ctx?.order) ? ctx.order : [];
  const tieIds = new Set(
    (Array.isArray(ctx?.tieEntityIds) ? ctx.tieEntityIds : []).map((x: any) => asStr(x))
  );

  const isGm = asStr(action?.participants?.gmUserId) === asStr(user_id);

  const finalists = order.filter((e: any) => tieIds.has(asStr(e?.entityId)));

  const sorted = useMemo(
    () =>
      [...finalists].sort(
        (a, b) => (Number(b.tieResult) || 0) - (Number(a.tieResult) || 0),
      ),
    [finalists],
  );

  const maxResult = sorted[0] ? Number(sorted[0].tieResult) || 0 : 0;
  const winners = sorted.filter(
    (e) => (Number(e.tieResult) || 0) === maxResult,
  );
  const isTie = winners.length > 1;

  const handleClick = (actionKey: 'reroll' | 'confirm') => {
    const payload = { action: actionKey };
    patch(payload);
    onSubmit(payload);
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Тай-брейк: результаты</div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30">
        <div className="text-xs text-muted-foreground mb-2">
          Броски финалистов:
        </div>
        <ol className="space-y-2">
          {sorted.map((e: any, i: number) => {
            const isWinner = (Number(e.tieResult) || 0) === maxResult;
            return (
              <li
                key={asStr(e.entityId)}
                className="flex items-center justify-between rounded border px-3 py-2 bg-zinc-950/30"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white/40 tabular-nums w-4">
                    {i + 1}.
                  </span>
                  <span
                    className={
                      isWinner
                        ? 'text-yellow-400 font-semibold'
                        : 'text-white/80'
                    }
                  >
                    {asStr(e?.name, asStr(e?.entityId))}
                  </span>
                  {isWinner && !isTie && (
                    <span className="text-yellow-400 text-xs">👑</span>
                  )}
                  {isWinner && isTie && (
                    <span className="text-red-400 text-xs">⚔️ ничья</span>
                  )}
                </div>
                <span className="text-white font-semibold tabular-nums text-lg">
                  {e.tieResult ?? '—'}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {isGm && (
        <div className="flex gap-2">
          {isTie ? (
            <button
              type="button"
              className="border-2 border-red-500 rounded px-3 py-2 text-sm font-semibold text-red-400 flex-1"
              onClick={() => handleClick('reroll')}
            >
              ⚔️ Ничья — перебросить
            </button>
          ) : (
            <button
              type="button"
              className="border-2 border-yellow-500 rounded px-3 py-2 text-sm font-semibold text-yellow-400 flex-1"
              onClick={() => handleClick('confirm')}
            >
              👑 Подтвердить победителя
            </button>
          )}
        </div>
      )}

      {!isGm && (
        <div className="text-sm text-white/60 text-center">
          {isTie
            ? '⚔️ Ничья — мастер запустит перебросок'
            : 'Ждём решения мастера…'}
        </div>
      )}
    </div>
  );
}
