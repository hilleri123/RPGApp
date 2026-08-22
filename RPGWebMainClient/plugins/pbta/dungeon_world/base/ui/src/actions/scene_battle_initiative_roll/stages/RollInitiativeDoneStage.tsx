'use client';

import React, { useMemo } from 'react';

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function asStr(x: any, fb = '') {
  const s = String(x ?? '').trim();
  return s || fb;
}

export function RollInitiativeDoneStage({
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
  const ctx = (isPlainObject(wf?.stageData) && Object.keys(wf.stageData).length ? wf.stageData : wf?.context) ?? {};
  const order: any[] = Array.isArray(ctx?.order) ? ctx.order : [];

  const rolled = useMemo(() => {
    const xs = order
      .filter((e) => e && typeof e === 'object' && e.result != null)
      .slice()
      .sort((a, b) => Number(b.result) - Number(a.result));
    return xs;
  }, [order]);

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Инициатива готова</div>

      {rolled.length ? (
        <div className="rounded border px-3 py-2 bg-zinc-950/30">
          <div className="text-sm text-muted-foreground mb-1">Результаты:</div>
          <ul className="list-disc pl-5 text-sm text-white/90 space-y-1">
            {rolled.map((e, i) => (
              <li key={String(e?.entityId ?? i)}>
                <span className="font-semibold">{asStr(e?.name, asStr(e?.entityId, '—'))}</span>
                <span className="text-white/60"> — {String(e?.result)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-sm text-white/70">—</div>
      )}

      <div className="text-xs text-muted-foreground">action: {asStr(action?.actionKey, '—')}</div>
    </div>
  );
}
