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
  kind?: string;
  name?: string;
  ownerUserId?: string | null;
  rolled?: boolean;
  result?: number | null;
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
        result: e.result == null ? null : num(e.result, 0),
      }));

    xs.sort((a, b) => {
      const ar = a.result == null ? -999 : a.result;
      const br = b.result == null ? -999 : b.result;
      if (br !== ar) return br - ar;
      const ak = a.kind === 'pc' ? 0 : 1;
      const bk = b.kind === 'pc' ? 0 : 1;
      if (ak !== bk) return ak - bk;
      return asStr(a.entityId).localeCompare(asStr(b.entityId));
    });

    return xs;
  }, [orderRaw]);

  // activeIndex берём из сцены (если она вложена как у тебя: action.scene.scene.data.combat.activeIndex)
  const activeIndex = useMemo(() => {
    const combat = action?.scene?.scene?.data?.combat;
    if (!combat) return 0;
    const ai = num(combat.activeIndex, 0);
    return Math.max(0, Math.min(sorted.length - 1, ai));
  }, [action, sorted.length]);

  const allRolled = sorted.length > 0 && sorted.every((e) => e.result != null);

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Инициатива: порядок хода</div>

      {!sorted.length ? (
        <div className="text-sm text-white/70">Пока нет участников.</div>
      ) : null}

      <ol className="relative border-s border-white/15">
        {sorted.map((e, i) => {
          const isActive = i === activeIndex;
          const isMe = !!user_id && !!e.ownerUserId && asStr(e.ownerUserId) === user_id;

          const dotCls = isActive
            ? 'bg-cyan-400 border-cyan-200'
            : e.result != null
              ? 'bg-white/60 border-white/30'
              : 'bg-zinc-700 border-white/10';

          return (
            <li key={e.entityId || String(i)} className="ms-4 py-2">
              <div className={`absolute w-3 h-3 rounded-full mt-2 -start-1.5 border ${dotCls}`} />

              <div className={`rounded border px-3 py-2 ${isActive ? 'border-cyan-400/40 bg-cyan-400/5' : 'border-white/10 bg-zinc-950/30'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-white/90">
                    <span className="font-semibold">{e.name || e.entityId || '—'}</span>
                    {isMe ? <span className="text-xs text-cyan-300 ml-2">(ты)</span> : null}
                  </div>

                  <div className="text-sm text-white/80 tabular-nums">
                    {e.result != null ? (
                      <span className="font-semibold">{e.result}</span>
                    ) : (
                      <span className="text-white/50">—</span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mt-1">
                  {isActive ? 'Сейчас ход' : i < activeIndex ? 'Уже сходил' : 'Ждёт хода'}
                  {!allRolled && e.result == null ? ' (ещё не кинул)' : ''}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {!allRolled ? (
        <div className="text-xs text-white/60">
          Результаты ещё не у всех. Порядок может поменяться после оставшихся бросков.
        </div>
      ) : null}
    </div>
  );
}
