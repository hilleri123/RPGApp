'use client';

import React, { useMemo } from 'react';

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}
function asStr(x: any, fb = '') {
  const s = String(x ?? '').trim();
  return s || fb;
}
function clampInt(n: any, lo: number, hi: number, fb: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fb;
  const i = Math.floor(v);
  return Math.max(lo, Math.min(hi, i));
}

export function RollInitiativeBetStage({
  user_id,
  action,
  value,
  patch,
}: {
  user_id: string;
  action: any;
  value: any;
  patch: (p: any) => void;
}) {
  const wf: any = action?.workflow ?? {};
  const ctx =
    (isPlainObject(wf?.stageData) && Object.keys(wf.stageData).length ? wf.stageData : null) ??
    wf?.context ??
    {};

  const order: any[] = Array.isArray(ctx?.order) ? ctx.order : [];

  const myEntry = useMemo(() => {
    if (!user_id) return null;
    return order.find((e) => isPlainObject(e) && asStr(e.ownerUserId) === asStr(user_id)) ?? null;
  }, [order, user_id]);

  const myName = asStr(myEntry?.name, asStr(myEntry?.entityId, '—'));
  const available = clampInt(myEntry?.available_tokens, 0, 999999, 0);

  const isMeInGame = !!myEntry;
  const spend = clampInt(value?.spend_tokens, 0, available, 0);

  const stats = useMemo(() => {
    return order
      .filter((e) => isPlainObject(e))
      .map((e) => ({
        id: asStr(e.entityId, ''),
        name: asStr(e.name, asStr(e.entityId, '—')),
        hasBet: e.spend_tokens != null,
        spend: e.spend_tokens == null ? null : clampInt(e.spend_tokens, 0, 999999, 0),
      }));
  }, [order]);

  const setSpend = (n: number) => {
    const v = clampInt(n, 0, available, 0);
    patch({ spend_tokens: v });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Ставка жетонов</div>

      {isMeInGame ? (
        <>
          <div className="rounded border px-3 py-2 bg-zinc-950/30 space-y-1">
            <div className="text-sm text-muted-foreground">
              Твой персонаж: <span className="text-white font-semibold">{myName}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Доступно жетонов: <span className="text-white/80 tabular-nums">{available}</span>
            </div>
          </div>

          {/* Инпут + -1/+1/Max */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="border-2 rounded px-2 py-2 text-sm font-semibold text-white"
              onClick={() => setSpend(spend - 1)}
              disabled={spend <= 0}
            >
              -1
            </button>
            <input
              className="w-full rounded border bg-zinc-950/30 px-3 py-2 text-sm text-center"
              type="number"
              min={0}
              max={available}
              value={spend}
              onChange={(e) => setSpend(Number(e.target.value))}
            />
            <button
              type="button"
              className="border-2 rounded px-2 py-2 text-sm font-semibold text-white"
              onClick={() => setSpend(spend + 1)}
              disabled={spend >= available}
            >
              +1
            </button>
            <button
              type="button"
              className="border-2 rounded px-3 py-2 text-sm font-semibold text-white"
              onClick={() => setSpend(available)}
              title="Поставить максимум"
            >
              Max
            </button>
          </div>

          {/* 10 кружков */}
          <div className="flex items-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => {
              const val = i + 1;
              const active = spend >= val;
              const disabled = val > available;
              return (
                <button
                  key={val}
                  type="button"
                  className={
                    'w-12 h-12 rounded-full border flex items-center justify-center text-[15px] ' +
                    (disabled
                      ? 'border-white/10 text-white/20 cursor-not-allowed'
                      : active
                      ? 'bg-emerald-500 border-emerald-400 text-black'
                      : 'border-white/40 text-white/60 hover:border-emerald-400 hover:text-emerald-300')
                  }
                  onClick={() => !disabled && setSpend(val)}
                  disabled={disabled}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-sm text-white/70">
          У тебя нет персонажа в этой сцене (или не найден ownerUserId).
        </div>
      )}

      <div className="rounded border px-3 py-2 bg-zinc-950/30">
        <div className="text-xs text-muted-foreground mb-2">Участники</div>
        <div className="space-y-1">
          {stats.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-xs">
              <span className="text-white/80">{e.name}</span>
              {e.hasBet ? (
                <span className="text-white/70 tabular-nums">поставил</span>
              ) : (
                <span className="text-white/40">не поставил</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
