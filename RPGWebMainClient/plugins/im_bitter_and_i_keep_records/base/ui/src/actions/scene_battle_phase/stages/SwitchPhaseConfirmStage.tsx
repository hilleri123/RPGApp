'use client';

import React, { useMemo } from 'react';

function phaseTitle(p: string) {
  switch (p) {
    case 'move': return 'Движение';
    case 'melee': return 'Ближний бой';
    case 'ranged': return 'Стрельба';
    case 'other': return 'Прочие действия';
    default: return p || '—';
  }
}

export function SwitchPhaseConfirmStage({
  action,
  value,
  patch,
}: {
  user_id?: string;
  action: any;
  value: any;
  patch: (p: any) => void;
}) {
  const wf: any = action?.workflow ?? {};
  const stageData = wf?.stageData;
  const context = wf?.context;

  // берем stageData только если он непустой объект
  const ctx =
    stageData && typeof stageData === 'object' && !Array.isArray(stageData) && Object.keys(stageData).length > 0
      ? stageData
      : (context ?? {});
  const pending: any[] = Array.isArray(ctx?.pending) ? ctx.pending : [];

  const decision: 'confirm' | 'cancel' | null =
    value?.decision === 'confirm' || value?.decision === 'cancel' ? value.decision : null;

  const force: boolean = Boolean(value?.force);

  const baseBtn =
    'border-2 rounded px-3 py-2 text-sm font-semibold transition-colors text-white flex-1 ' +
    'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2';

  const confirmStyle: React.CSSProperties =
    decision === 'confirm'
      ? { outline: '4px solid #34d399', outlineOffset: 2, background: 'rgba(16,185,129,0.22)', borderColor: '#34d399' }
      : { outline: '0px solid transparent', background: 'transparent', borderColor: 'rgba(161,161,170,0.45)' };

  const cancelStyle: React.CSSProperties =
    decision === 'cancel'
      ? { outline: '4px solid #f87171', outlineOffset: 2, background: 'rgba(239,68,68,0.18)', borderColor: '#f87171' }
      : { outline: '0px solid transparent', background: 'transparent', borderColor: 'rgba(161,161,170,0.45)' };

  const currentPhase = String(ctx?.currentPhase ?? ctx?.snapshot?.currentPhase ?? '—');
  const nextPhase = String(ctx?.nextPhase ?? '—');

  const snapshot = ctx?.snapshot ?? {};
  const initiativeOrder: string[] = Array.isArray(snapshot?.initiativeOrder) ? snapshot.initiativeOrder : [];
  const activeIndex: number = Number.isFinite(Number(snapshot?.activeIndex)) ? Number(snapshot.activeIndex) : 0;

  const activeId = initiativeOrder.length && activeIndex >= 0 && activeIndex < initiativeOrder.length ? initiativeOrder[activeIndex] : null;

  const submitPreview = useMemo(() => {
    const payload: any = { decision: decision ?? '(select)' };
    if (decision === 'confirm') payload.force = !!force;
    return JSON.stringify(payload);
  }, [decision, force]);

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Переключение фазы боя</div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30 space-y-1">
        <div className="text-sm text-muted-foreground">
          Текущая фаза: <span className="text-white font-semibold">{phaseTitle(currentPhase)}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Следующая фаза: <span className="text-white font-semibold">{phaseTitle(nextPhase)}</span>
        </div>
      </div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30 space-y-1">
        <div className="text-sm text-muted-foreground">Снимок:</div>
        <div className="text-sm text-white/90">
          Инициатива: {initiativeOrder.length ? `${initiativeOrder.length} участн.` : '—'}
          {activeId ? `, активный: ${activeId}` : ''}
        </div>
        <div className="text-sm text-white/70">Contacts count: {Number(snapshot?.contactsCount ?? 0) || 0}</div>
      </div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30">
        <div className="text-sm text-muted-foreground mb-1">Незавершено:</div>
        {pending.length ? (
          <ul className="list-disc pl-5 text-sm text-white/90 space-y-1">
            {pending.map((p, i) => (
              <li key={String(p?.id ?? i)}>
                <span className="font-semibold">{String(p?.action ?? '—')}</span>
                <span className="text-white/60"> ({String(p?.id ?? '—')})</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-white/70">Нет блокирующих пунктов.</div>
        )}
      </div>

      {pending.length ? (
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => patch({ force: e.target.checked })}
          />
          Всё равно переключить (force)
        </label>
      ) : null}

      <div className="flex flex-row gap-2">
        <button
          type="button"
          aria-pressed={decision === 'confirm'}
          className={baseBtn}
          style={confirmStyle}
          onClick={() => patch({ decision: 'confirm' })}
        >
          Переключить
        </button>

        <button
          type="button"
          aria-pressed={decision === 'cancel'}
          className={baseBtn}
          style={cancelStyle}
          onClick={() => patch({ decision: 'cancel', force: false })}
        >
          Отмена
        </button>
      </div>

      <div className="text-xs text-muted-foreground">Submit отправит: {submitPreview}.</div>
    </div>
  );
}
