'use client';

import React, { useEffect, useMemo, useState } from 'react';

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

export function RollInitiativeRollOneStage({
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
    (isPlainObject(wf?.stageData) && Object.keys(wf.stageData).length ? wf.stageData : null)
    ?? wf?.context
    ?? {};

  const cur =
    ctx?.current
    ?? (Array.isArray(ctx?.order) && Number.isFinite(ctx?.currentIndex)
        ? ctx.order[ctx.currentIndex]
        : null)
    ?? {};

  const ownerUserId = asStr(cur?.ownerUserId, '');
  const rollerName = asStr(cur?.name, asStr(cur?.entityId, '—'));
  const total = clampInt(cur?.total, 0, 999, 0);
  const index = clampInt(cur?.index, 0, 999, 0);

  const isMyTurn = !!user_id && !!ownerUserId && user_id === ownerUserId;

  // draft/result в value
  const draftResult = clampInt(value?.result, 1, 20, 0);

  // маленькая “анимация” предпросмотра
  const [spin, setSpin] = useState<number>(draftResult || 1);
  useEffect(() => {
    if (!isMyTurn) return;
    if (draftResult >= 1 && draftResult <= 20) {
      setSpin(draftResult);
      return;
    }
    let t: any = null;
    let alive = true;
    t = setInterval(() => {
      if (!alive) return;
      setSpin(1 + Math.floor(Math.random() * 20));
    }, 90);
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [isMyTurn, draftResult]);

  const canRoll = isMyTurn;
  const canSubmit = isMyTurn && draftResult >= 1 && draftResult <= 20;

  const submitPreview = useMemo(() => {
    return JSON.stringify({ result: canSubmit ? draftResult : '(select)' });
  }, [canSubmit, draftResult]);

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Бросок инициативы</div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30 space-y-1">
        <div className="text-sm text-muted-foreground">
          Очередь: <span className="text-white/80">{total ? `${index + 1}/${total}` : '—'}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Сейчас кидает: <span className="text-white font-semibold">{rollerName}</span>
        </div>
      </div>

      <div className="rounded border px-3 py-3 bg-zinc-950/30 flex items-center justify-between">
        <div className="text-sm text-white/80">d20:</div>
        <div className="text-2xl font-semibold text-white">{spin}</div>
      </div>

      {isMyTurn ? (
        <div className="flex flex-row gap-2">
          <button
            type="button"
            className="border-2 rounded px-3 py-2 text-sm font-semibold transition-colors text-white flex-1"
            onClick={() => patch({ result: 1 + Math.floor(Math.random() * 20) })}
            disabled={!canRoll}
          >
            Бросить
          </button>

          <button
            type="button"
            className="border-2 rounded px-3 py-2 text-sm font-semibold transition-colors text-white flex-1"
            onClick={() => patch({ result: 20 })}
            disabled={!canRoll}
            title="Тестовая кнопка"
          >
            20
          </button>
        </div>
      ) : (
        <div className="text-sm text-white/70">
          Ждём бросок игрока.
        </div>
      )}

      <div className="rounded border px-3 py-2 bg-zinc-950/30">
        <div className="text-xs text-muted-foreground">Draft:</div>
        <div className="text-xs text-white/80">{submitPreview}</div>
        {!canSubmit && isMyTurn ? (
          <div className="text-xs text-white/60 mt-1">Нажми “Бросить”, чтобы выбрать результат.</div>
        ) : null}
      </div>

      {/* ВАЖНО: кнопка Submit у тебя снаружи в ActionModal.
          Она должна быть disabled, если !canSubmit — но если у тебя такого пока нет, ок.
          Главное: draft/value должен содержать {result}. */}
    </div>
  );
}
