// stages/SpendLoopStage.tsx
'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, CheckCircle, LogOut } from 'lucide-react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function SpendLoopStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const wf: any    = action?.workflow ?? {};
  const ctx        = wf?.context ?? {};
  const entry      = ctx?.entry ?? {};
  const obstacle   = ctx?.obstacle ?? {};
  const spends: any[] = obstacle?.spends ?? [];
  const spendRecords: any[] = entry?.spend_records ?? [];

  const scene       = action?.scene?.scene ?? {};
  const characters: any[] = scene?.characters ?? [];
  const char        = characters.find((c: any) => c.id === entry.characterId);
  const charSkills: Record<string, number> = char?.data?.skills ?? {};

  // навыки, которые применимы к obstacle и у которых есть хотя бы 1 очко
  const applicableSkills: string[] = useMemo(
    () =>
      (obstacle?.investigative_skills ?? []).filter(
        (s: string) => (charSkills[s] ?? 0) > 0
      ),
    [obstacle, charSkills],
  );

  const [selectedSkill, setSelectedSkill] = useState<string>(
    entry.chosen_skill && applicableSkills.includes(entry.chosen_skill)
      ? entry.chosen_skill
      : applicableSkills[0] ?? ''
  );

  const confirmedSpentBySkill: Record<string, number> = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of spendRecords) {
      if (!r.confirmed) continue;
      const k = r.skill_name;
      acc[k] = (acc[k] ?? 0) + (r.cost ?? 0);
    }
    return acc;
  }, [spendRecords]);

  // сумма уже подтверждённых трат по выбранному навыку
  const totalSpent = spendRecords
    .filter((r: any) => r.confirmed && r.skill_name === selectedSkill)
    .reduce((acc: number, r: any) => acc + (r.cost ?? 0), 0);

  const availablePts = Math.max(0, (charSkills[selectedSkill] ?? 0) - totalSpent);

  const confirmedNames = new Set(
    spendRecords.filter((r: any) => r.confirmed).map((r: any) => r.clue_spend_name)
  );

  const revealedRecords = spendRecords.filter((r: any) => r.confirmed && r.revealed);

  // кнопка "Завершить" всегда активна
  useEffect(() => {
    setSubmitEnabled(true);
  }, []);

  const handleRequestSpend = (spendName: string, cost: number) => {
    if (!selectedSkill) return;
    onSubmit({
      action: 'request_spend',
      clue_spend_name: spendName,
      skill_name: selectedSkill,   // <-- важно
    });
  };

  const handleFinish = () => {
    onSubmit({ action: 'finish' });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <ShoppingCart className="w-4 h-4 text-blue-400" />
        Расследование: {asStr(obstacle?.name || obstacle?.id, 'препятствие')}
      </div>

      {/* Выбор навыка в рамках этой стадии */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-white/50 uppercase tracking-wide">Навык</div>
        {applicableSkills.length === 0 ? (
          <div className="text-sm text-red-400">Нет подходящих навыков для этого препятствия</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {applicableSkills.map((s: string) => {
              const total = charSkills[s] ?? 0;
              const spent = confirmedSpentBySkill[s] ?? 0;
              const left  = Math.max(0, total - spent);

              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSkill(s)}
                  className={`
                    rounded border px-3 py-1.5 text-sm transition-colors
                    ${selectedSkill === s
                      ? 'border-blue-400 bg-blue-500/10 text-blue-200 font-semibold'
                      : 'border-white/20 hover:border-white/40 text-white/70'}
                  `}
                >
                  {s}
                  <span className="ml-1.5 text-xs text-white/40">
                    ({left}/{total} pts)
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Баланс выбранного навыка */}
      {selectedSkill && (
        <div className="rounded border px-3 py-2 bg-zinc-950/30 text-sm space-y-0.5">
          <div>
            Навык: <span className="font-semibold text-blue-200">{selectedSkill}</span>
          </div>
          <div className="text-white/60">
            Доступно очков:{' '}
            <span className="text-white font-semibold tabular-nums">{availablePts}</span>
            <span className="text-white/40 ml-1">(потрачено {totalSpent})</span>
          </div>
        </div>
      )}

      {/* base_text */}
      {obstacle?.base_text && (
        <div className="rounded border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm text-blue-200">
          {obstacle.base_text}
        </div>
      )}

      {/* Полученные улики */}
      {revealedRecords.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-white/50 uppercase tracking-wide">Получено</div>
          {revealedRecords.map((r: any, i: number) => (
            <div
              key={i}
              className="rounded border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm text-green-200"
            >
              <div className="font-semibold mb-0.5">{r.clue_spend_name}</div>
              <div className="text-white/80">{r.info}</div>
            </div>
          ))}
        </div>
      )}

      {/* Доступные улики */}
      {spends.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-white/50 uppercase tracking-wide">Доступные улики</div>
          {spends.map((s: any, i: number) => {
            const alreadyBought = confirmedNames.has(s.name);
            const cost = s.cost ?? 1;
            const canAfford = selectedSkill && availablePts >= cost;

            return (
              <div
                key={i}
                className={`
                  rounded border px-3 py-2 text-sm
                  ${alreadyBought
                    ? 'border-green-500/30 bg-green-500/5 text-white/50'
                    : 'border-white/15 bg-zinc-950/30'}
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium flex items-center gap-1.5">
                      {alreadyBought && (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      )}
                      {s.name}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      Стоимость:{' '}
                      <span className="text-white/60">
                        {cost} очк. ({selectedSkill || '—'})
                      </span>
                    </div>
                  </div>

                  {!alreadyBought && (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => handleRequestSpend(s.name, cost)}
                      className={`
                        shrink-0 rounded border px-2.5 py-1 text-xs font-semibold transition-colors
                        ${canAfford
                          ? 'border-blue-400/60 text-blue-300 hover:bg-blue-500/10'
                          : 'border-white/10 text-white/25 cursor-not-allowed'}
                      `}
                    >
                      Купить ({cost} pts)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Завершить */}
      <button
        type="button"
        onClick={handleFinish}
        className="flex items-center justify-center gap-2 rounded border border-white/20 px-3 py-2 text-sm text-white/70 hover:border-white/40 hover:text-white/90 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Завершить расследование
      </button>
    </div>
  );
}
