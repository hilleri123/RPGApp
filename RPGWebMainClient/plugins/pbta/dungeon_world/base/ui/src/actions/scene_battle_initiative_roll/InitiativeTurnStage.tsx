'use client';

import { useEffect } from 'react';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { readInitiative } from '../../shared/initiative';

export default function InitiativeTurnStage(props: ActionHandlerProps) {
  const { user_id, action, onSubmit, setSubmitEnabled, readOnly = false } = props;

  const wf: any = action?.workflow ?? {};
  const snapshot = wf.stageData?.initiative ?? {};
  const names: Record<string, string> = snapshot?.names && typeof snapshot.names === 'object' ? snapshot.names : {};
  const ini = readInitiative({ initiative: snapshot });

  const isGm = String(action?.participants?.gmUserId ?? '') === String(user_id);
  const active = wf.status === 'active';
  const canAct = active && isGm && !readOnly;

  // Действие завершается одним нажатием, общая кнопка Submit не нужна.
  useEffect(() => {
    setSubmitEnabled(false);
  }, [setSubmitEnabled]);

  const run = (payload: Record<string, unknown>) => {
    if (canAct) onSubmit(payload);
  };

  const btn =
    'rounded border px-3 py-1.5 text-sm disabled:opacity-40 border-gray-700 bg-gray-900 text-gray-100 hover:border-violet-500/60';

  return (
    <div className="space-y-3 text-sm text-gray-200">
      <div className="flex items-center justify-between rounded border border-gray-700 bg-black/20 p-3">
        <div className="font-medium">Очередь ходов</div>
        <div className="text-xs text-gray-400">Раунд {ini.round}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={!canAct} onClick={() => run({ op: 'prev' })}>
          ← Назад
        </button>
        <button
          type="button"
          className={`${btn} !border-violet-500/60 !bg-violet-500/15`}
          disabled={!canAct}
          onClick={() => run({ op: 'next' })}
        >
          Следующий ход →
        </button>
        <button
          type="button"
          className={`${btn} ml-auto hover:!border-red-500/60`}
          disabled={!canAct}
          onClick={() => run({ op: 'end' })}
        >
          Закончить бой
        </button>
      </div>

      <ol className="space-y-1">
        {ini.order.map((id, idx) => {
          const isActive = idx === ini.active_index;
          return (
            <li key={id}>
              <button
                type="button"
                disabled={!canAct || isActive}
                onClick={() => run({ op: 'set', entity_id: id })}
                className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left ${
                  isActive
                    ? 'border-rose-500/60 bg-rose-500/10 text-rose-100'
                    : 'border-gray-700 bg-gray-900/40 hover:border-violet-500/60'
                }`}
              >
                <span className="w-5 text-xs tabular-nums text-gray-500">{idx + 1}</span>
                <span className="flex-1 truncate">{names[id] ?? 'Нет в сцене'}</span>
                {ini.values[id] !== undefined ? (
                  <span className="text-xs tabular-nums text-gray-400">{ini.values[id]}</span>
                ) : null}
                {isActive ? <span className="text-xs">Сейчас ход</span> : null}
              </button>
            </li>
          );
        })}
      </ol>

      {!active ? <p className="text-xs text-gray-500">Действие выполнено.</p> : null}
    </div>
  );
}
