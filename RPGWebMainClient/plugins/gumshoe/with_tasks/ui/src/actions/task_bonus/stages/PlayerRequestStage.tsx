// plugins/gumshoe/task_bonus/stages/PlayerRequestStage.tsx
'use client';
import React, { useEffect } from 'react';
import { CheckCircle, Star, ClipboardList, X } from 'lucide-react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function PlayerRequestStage({ user_id, action, onSubmit, setSubmitEnabled }: any) {
  const isGm = asStr(action?.participants?.gmUserId) === asStr(user_id);

  const wf: any    = action?.workflow ?? {};
  const ctx        = wf?.context ?? {};
  const scene      = action?.scene?.scene ?? {};
  const characters: any[] = scene?.characters ?? [];
  const entry      = ctx?.entry ?? {};

  const myChar        = characters.find((c: any) => c.id === entry.characterId);
  const tasks: any[]   = myChar?.data?.tasks ?? [];
  const bonuses: any[] = myChar?.data?.bonuses ?? [];

  // сколько раз каждое задание было выполнено
  const completionCount: Record<string, number> = {};
  for (const b of bonuses) {
    if (b.task_id) {
      completionCount[b.task_id] = (completionCount[b.task_id] ?? 0) + 1;
    }
  }

  const totalBonus = bonuses.reduce((acc: number, b: any) => acc + (b.bonus ?? 0), 0);

  useEffect(() => {
    setSubmitEnabled(false);
  }, []);

  if (isGm) {
    return (
      <div className="rounded border p-3 text-sm text-white/50 italic">
        Ожидаем запрос от игрока…
      </div>
    );
  }

  return (
    <div className="rounded border p-3 flex flex-col gap-3">

      {/* заголовок + кнопка закрыть */}
      <div className="flex items-center justify-between">
        <div className="font-medium flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-yellow-300" />
          Задания для {myChar?.name}
        </div>
        <button
          type="button"
          onClick={() => onSubmit({ action: 'close' })}
          className="rounded border border-white/15 p-1 text-white/40 hover:text-white/70 hover:border-white/30 transition-colors"
          title="Закрыть"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* комментарий от мастре */}
      {entry?.comment && (
        <div className="rounded border border-yellow-500/30 bg-red-500/5 px-3 py-2 text-sm">
          <div className="text-xs text-white/50 uppercase tracking-wide mb-1">Итого бонусов</div>
          <div className="text-2xl font-bold text-red-200 tabular-nums">
            {entry.comment}
          </div>
        </div>
      )}

      {/* итого бонусов */}
      <div className="rounded border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-sm">
        <div className="text-xs text-white/50 uppercase tracking-wide mb-1">Итого бонусов</div>
        <div className="text-2xl font-bold text-yellow-200 tabular-nums">
          {totalBonus > 0 ? `+${totalBonus}` : totalBonus}
        </div>
      </div>

      {/* выполненные */}
      {bonuses.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-white/50 uppercase tracking-wide">Выполнено</div>
          {bonuses.map((b: any, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded border border-green-500/30 bg-green-500/5 px-2 py-1.5 text-sm"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                <span className="text-white/80">{b.description}</span>
              </div>
              <span className="font-semibold text-green-300 tabular-nums shrink-0">
                {b.bonus > 0 ? `+${b.bonus}` : b.bonus}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* все задания */}
      {tasks.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-white/50 uppercase tracking-wide">Все задания</div>
          {tasks.map((t: any) => {
            const count = completionCount[t.id] ?? 0;
            return (
              <div
                key={t.id}
                className={`
                  rounded border px-3 py-2 text-sm flex items-start justify-between gap-2
                  ${count > 0
                    ? 'border-green-500/20 bg-green-500/5'
                    : 'border-white/15 bg-zinc-950/30'}
                `}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    {count > 0 && <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                    <Star className="w-3 h-3 text-yellow-300/70 shrink-0" />
                    <span className="text-white/80">{t.description}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5 ml-5">
                    <span>
                      Бонус:{' '}
                      <span className={t.bonus >= 0 ? 'text-green-300' : 'text-red-300'}>
                        {t.bonus > 0 ? `+${t.bonus}` : t.bonus}
                      </span>
                    </span>
                    {count > 0 && (
                      <span className="text-green-400/70">
                        выполнено: {count}×
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSubmit({ task_id: t.id })}
                  className="shrink-0 rounded border border-yellow-400/60 px-2.5 py-1 text-xs font-semibold text-yellow-200 hover:bg-yellow-500/10 transition-colors"
                >
                  {count > 0 ? 'Ещё раз' : 'Запросить'}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-white/40 italic">Задания не назначены</div>
      )}
    </div>
  );
}