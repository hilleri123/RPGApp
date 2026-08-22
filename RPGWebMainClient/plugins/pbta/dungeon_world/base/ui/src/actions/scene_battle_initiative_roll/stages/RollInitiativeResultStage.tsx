'use client';

import React, { useMemo } from 'react';

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}
function asStr(x: any, fb = '') {
  const s = String(x ?? '').trim();
  return s || fb;
}
function num(x: any, fb = 0) {
  const v = Number(x);
  return Number.isFinite(v) ? v : fb;
}

type Entry = {
  entityId?: string;
  name?: string;
  ownerUserId?: string | null;
  available_tokens?: number;
  spend_tokens?: number | null;
  tieRolled?: boolean;
  tieResult?: number | null;
};

export function RollInitiativeResultStage({
  user_id,
  action,
}: {
  user_id: string;
  action: any;
}) {
  const wf: any = action?.workflow ?? {};
  const ctx = (isPlainObject(wf?.context) ? wf.context : {}) as any;
  const orderRaw: Entry[] = Array.isArray(ctx?.order) ? ctx.order : [];

  const sorted = useMemo(() => {
    const xs = orderRaw
      .filter((e) => isPlainObject(e))
      .map((e) => ({
        ...e,
        entityId: asStr(e.entityId, ''),
        name: asStr(e.name, ''),
        spend: e.spend_tokens == null ? 0 : num(e.spend_tokens, 0),
        tie: e.tieResult == null ? 0 : num(e.tieResult, 0),
      }));

    xs.sort((a, b) => {
      if (b.spend !== a.spend) return b.spend - a.spend;
      if (b.tie !== a.tie) return b.tie - a.tie;
      return asStr(a.entityId).localeCompare(asStr(b.entityId));
    });

    return xs;
  }, [orderRaw]);

  const winner = sorted[0];
  const maxSpend = winner ? winner.spend : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/40">
            Инициатива
          </div>
          <div className="font-semibold text-white text-lg">
            Итог ставок и очереди
          </div>
        </div>
        {winner && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/40">
            <span className="text-base">👑</span>
            <div className="text-xs text-amber-200">
              Ходит первым: <span className="font-semibold">{winner.name || winner.entityId}</span>
            </div>
          </div>
        )}
      </div>

      {!sorted.length && (
        <div className="text-sm text-white/70">
          Пока нет участников.
        </div>
      )}

      {!!sorted.length && (
        <ol className="space-y-2">
          {sorted.map((e, i) => {
            const isMe =
              !!user_id && !!e.ownerUserId && asStr(e.ownerUserId) === asStr(user_id);
            const isWinner = i === 0;
            const isSecond = i === 1;
            const isThird = i === 2;

            let badge = null;
            if (isWinner) badge = '🥇';
            else if (isSecond) badge = '🥈';
            else if (isThird) badge = '🥉';

            const bg =
              isWinner
                ? 'bg-amber-500/15 border-amber-400/40'
                : isMe
                ? 'bg-cyan-500/10 border-cyan-400/40'
                : 'bg-zinc-950/40 border-white/10';

            return (
              <li
                key={e.entityId || String(i)}
                className={`rounded-lg border px-3 py-2 ${bg}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-black/40 border border-white/10 tabular-nums text-xs text-white/70">
                      {i + 1}
                    </div>
                    <div className="flex flex-col">
                      <div className="text-sm text-white/90 flex items-center gap-2">
                        <span className="font-semibold">
                          {e.name || e.entityId || '—'}
                        </span>
                        {badge && (
                          <span className="text-base" aria-hidden="true">
                            {badge}
                          </span>
                        )}
                        {isMe && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/40">
                            это ты
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/50">
                        жетоны: <span className="text-white/80 font-medium">{e.spend}</span>
                        {maxSpend > 0 && !isWinner && (
                          <span className="ml-1 text-white/40">
                            ({maxSpend - e.spend}+ до лидера)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end text-right">
                    <div className="text-[11px] text-white/50 mb-0.5">
                      ставка
                    </div>
                    <div className="text-sm text-white tabular-nums">
                      <span className="font-semibold">{e.spend}</span>
                      {e.tie ? (
                        <span className="text-white/60 text-xs ml-2">
                          d20: <span className="font-semibold">{e.tie}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="text-[11px] text-white/50 border-t border-white/5 pt-2">
        Побеждает максимальная ставка; при равенстве учитывается d20 между финалистами.
      </div>
    </div>
  );
}
