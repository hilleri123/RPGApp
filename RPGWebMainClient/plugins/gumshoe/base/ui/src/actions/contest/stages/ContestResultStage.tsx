// plugins/gumshoe/contest/stages/ContestResultStage.tsx
'use client';

import React, { useEffect, useMemo } from 'react';
import { Crown, Trophy, Minus } from 'lucide-react';
import { DiceRollDisplay, DiceInterpreter } from '@/plugins/common/ui';

function asStr(x: any, fb = '') {
  return String(x ?? '').trim() || fb;
}

export function ContestResultStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const wf = action?.workflow ?? {};
  const ctx = wf?.context ?? {};
  const entry = ctx?.entry ?? {};
  const skills: any[] = ctx?.skills ?? [];
  const participants = action?.participants ?? {};
  const isGm = String(participants?.gmUserId ?? '') === String(user_id);
  const isDone = String(wf?.stageKey ?? '') === 'completed';

  const rounds: any[] = entry?.rounds ?? [];
  const sideA = entry?.side_a ?? {};
  const sideB = entry?.side_b ?? {};
  const skillId: string = entry?.skill_id ?? '';

  const selectedSkill = useMemo(
    () => skills.find((s: any) => s.id === skillId) ?? null,
    [skills, skillId],
  );

  const autoRoundWinner: 'a' | 'b' | 'draw' = useMemo(() => {
    const ta = sideA?.roll_total ?? null;
    const tb = sideB?.roll_total ?? null;
    if (ta == null || tb == null) return 'draw';

    const aHit = ta >= 4;
    const bHit = tb >= 4;

    if (aHit && bHit) return 'draw';
    if (!aHit && bHit) return 'b';
    if (aHit && !bHit) return 'a';
    return 'draw';
  }, [sideA, sideB]);

  const autoFinishAction: 'next_round' | 'finish' = useMemo(() => {
    const ta = sideA?.roll_total ?? null;
    const tb = sideB?.roll_total ?? null;
    if (ta == null || tb == null) return 'next_round';

    const aHit = ta >= 4;
    const bHit = tb >= 4;

    return aHit && bHit ? 'next_round' : 'finish';
  }, [sideA, sideB]);

  const autoFinalWinner: 'a' | 'b' | 'draw' = useMemo(() => {
    const ta = sideA?.roll_total ?? null;
    const tb = sideB?.roll_total ?? null;
    if (ta == null || tb == null) return 'draw';

    const aHit = ta >= 4;
    const bHit = tb >= 4;

    if (aHit && bHit) return 'draw';
    if (!aHit && bHit) return 'b';
    if (aHit && !bHit) return 'a';
    return 'draw';
  }, [sideA, sideB]);

  const gumshoeLabel = useMemo(() => {
    const ta = sideA?.roll_total ?? null;
    const tb = sideB?.roll_total ?? null;
    if (ta == null || tb == null) return null;

    const aHit = ta >= 4;
    const bHit = tb >= 4;

    if (aHit && bHit) return `Оба успех (${ta} и ${tb}) — нужен ещё раунд`;
    if (!aHit && bHit) return `A провал (${ta}), B успех (${tb}) — победила B`;
    if (aHit && !bHit) return `A успех (${ta}), B провал (${tb}) — победила A`;
    return `Оба провал (${ta} и ${tb}) — ничья`;
  }, [sideA, sideB]);

  const [roundWinner, setRoundWinner] = React.useState<'a' | 'b' | 'draw'>(
    value?.round_winner ?? autoRoundWinner,
  );
  const [finishAction, setFinishAction] = React.useState<'next_round' | 'finish'>(
    value?.action ?? autoFinishAction,
  );
  const [finalWinner, setFinalWinner] = React.useState<'a' | 'b' | 'draw'>(
    value?.final_winner ?? autoFinalWinner,
  );

  useEffect(() => {
    if (!value?.round_winner) setRoundWinner(autoRoundWinner);
    if (!value?.action) setFinishAction(autoFinishAction);
    if (!value?.final_winner) setFinalWinner(autoFinalWinner);
  }, [autoRoundWinner, autoFinishAction, autoFinalWinner, value?.round_winner, value?.action, value?.final_winner]);

  useEffect(() => {
    setSubmitEnabled(isGm && !isDone);
  }, [isGm, isDone, setSubmitEnabled]);

  const handleSubmit = () => {
    if (!isGm || isDone) return;

    onSubmit({
      round_winner: finishAction === 'next_round' ? 'draw' : roundWinner,
      action: finishAction,
      final_winner: finishAction === 'finish' ? finalWinner : undefined,
    });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <Crown className="w-4 h-4 text-yellow-400" />
        Состязание: результат
        {selectedSkill && (
          <span className="text-xs text-white/40 font-normal normal-case">
            — {selectedSkill.title}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SideResultCard sideKey="a" side={sideA} autoWinner={autoRoundWinner} />
        <SideResultCard sideKey="b" side={sideB} autoWinner={autoRoundWinner} />
      </div>

      {rounds.length > 0 && (
        <div className="rounded border border-white/10 p-3 flex flex-col gap-2">
          <div className="text-xs text-white/50 uppercase tracking-wide">История раундов</div>
          <div className="flex flex-col gap-2">
            {rounds.map((r, i) => (
              <div key={i} className="rounded border border-white/10 p-2 text-sm flex items-start gap-2">
                <span className="text-white/40 font-mono text-xs mt-0.5 shrink-0">
                  R{r.round_num ?? i + 1}
                </span>
                <span className="text-white/60">{asStr(r.result_text, '—')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isGm && !isDone && (
        <div className="rounded border border-white/10 p-3 flex flex-col gap-3">
          <div className="text-xs text-white/50 uppercase tracking-wide">Решение мастера</div>

          {gumshoeLabel && (
            <div className="rounded border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
              По правилам GUMSHOE: <span className="text-white/80">{gumshoeLabel}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="text-xs text-white/40">Победитель раунда</div>
            <div className="flex gap-2 flex-wrap">
              {(['a', 'b', 'draw'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setRoundWinner(w)}
                  disabled={finishAction === 'next_round'}
                  className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                    finishAction === 'next_round'
                      ? 'border-white/10 text-white/30 cursor-not-allowed'
                      : roundWinner === w
                      ? 'border-yellow-400 bg-yellow-500/10 text-yellow-200'
                      : 'border-white/20 text-white/70 hover:border-white/40'
                  }`}
                >
                  {w === 'a' ? 'Победила A' : w === 'b' ? 'Победила B' : 'Ничья'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="text-xs text-white/40">Следующий шаг</div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setFinishAction('next_round')}
                className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                  finishAction === 'next_round'
                    ? 'border-green-400 bg-green-500/10 text-green-200'
                    : 'border-white/20 text-white/70 hover:border-white/40'
                }`}
              >
                Ещё раунд
              </button>
              <button
                type="button"
                onClick={() => setFinishAction('finish')}
                className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                  finishAction === 'finish'
                    ? 'border-red-400 bg-red-500/10 text-red-200'
                    : 'border-white/20 text-white/70 hover:border-white/40'
                }`}
              >
                Завершить состязание
              </button>
            </div>
          </div>

          {finishAction === 'finish' && (
            <div className="flex flex-col gap-1.5">
              <div className="text-xs text-white/40">Итоговый победитель</div>
              <div className="flex gap-2 flex-wrap items-center">
                {(['a', 'b'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setFinalWinner(w)}
                    className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                      finalWinner === w
                        ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                        : 'border-white/20 text-white/70 hover:border-white/40'
                    }`}
                  >
                    {w === 'a' ? asStr(sideA.name, 'Сторона A') : asStr(sideB.name, 'Сторона B')}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setFinalWinner('draw')}
                  className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                    finalWinner === 'draw'
                      ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                      : 'border-white/20 text-white/70 hover:border-white/40'
                  }`}
                >
                  Ничья
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            className="rounded border px-3 py-2 text-sm font-semibold border-yellow-400/70 text-yellow-200 hover:bg-yellow-500/10"
          >
            Применить решение
          </button>
        </div>
      )}

      {isDone && (
        <div className="flex flex-col gap-2">
          {entry.final_winner && entry.final_winner !== 'draw' && (
            <div className="flex items-center gap-2 rounded border border-yellow-400/30 bg-yellow-500/5 px-3 py-2 text-sm text-yellow-200">
              <Trophy className="w-4 h-4 shrink-0" />
              Победитель:{' '}
              <span className="font-semibold">
                {entry.final_winner === 'a'
                  ? asStr(sideA.name, 'Сторона A')
                  : asStr(sideB.name, 'Сторона B')}
              </span>
            </div>
          )}
          {entry.final_winner === 'draw' && (
            <div className="flex items-center gap-2 rounded border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/70">
              <Minus className="w-4 h-4 shrink-0" />
              Ничья
            </div>
          )}
          <div className="rounded border border-green-500/20 bg-green-500/5 p-3 text-sm text-green-100">
            Состязание завершено.
          </div>
        </div>
      )}
    </div>
  );
}

function SideResultCard({ sideKey, side, autoWinner }: {
  sideKey: 'a' | 'b';
  side: any;
  autoWinner: 'a' | 'b' | 'draw' | null;
}) {
  const dice: number[] = Array.isArray(side?.dice) ? side.dice : [];
  const total: number = side?.roll_total ?? 0;
  const pts: number = side?.skill_points ?? 0;
  const kind = side?.characterId ? 'character' : side?.npcId ? 'npc' : 'none';

  const isWinner = autoWinner === sideKey;
  const isDraw = autoWinner === 'draw';
  const hasRoll = dice.length > 0;
  const isHit = side?.passed ?? false;

  const cardBorder = isWinner
    ? 'border-yellow-400/50 bg-yellow-500/5'
    : isHit
    ? 'border-green-400/40 bg-green-500/5'
    : 'border-red-400/40 bg-red-500/5';

  const animKey = `${side?.canvas_seed ?? 'no-seed'}:${dice.join(',')}:${total}:${pts}`;

  const interpreter: DiceInterpreter = ({ dice: d, total: t }) => {
    if (!d.length) return { dieColors: [], outcome: null };
    const tot = t ?? d[0];
    const hit = side?.passed ?? false;

    return {
      dieColors: [hit ? 'good' : 'bad'],
      outcome: {
        label: hit ? 'Успех' : 'Неудача',
        color: hit ? 'good' : 'bad',
        effect: `${d[0]} + ${pts} pts = ${tot}`,
      },
    };
  };

  return (
    <div className={`rounded border p-3 flex flex-col gap-2 transition-all ${cardBorder}`}>
      <div className="flex items-center justify-between">
        <div className="font-semibold flex items-center gap-1.5">
          {isWinner && <Trophy className="w-3.5 h-3.5 text-yellow-400" />}
          {isDraw && <Minus className="w-3.5 h-3.5 text-white/40" />}
          {asStr(side?.name, `Сторона ${sideKey.toUpperCase()}`)}
        </div>
        <span className={`text-xs ${isHit ? 'text-green-300' : 'text-red-300'}`}>
          {isHit ? 'успех' : 'неудача'}
        </span>
      </div>

      {hasRoll ? (
        <>
          <DiceRollDisplay
            key={animKey}
            dice={dice}
            total={total}
            rollLabel={`1d6 + ${pts} pts`}
            interpreter={interpreter}
            canvasSeed={side?.canvas_seed ?? null}
            animKey={animKey}
          />
          <div className="rounded border border-white/10 bg-zinc-950/30 px-3 py-2 text-sm text-white/70">
            Сумма: <span className="font-semibold text-white">{dice[0]} + {pts} = {total}</span>
          </div>
        </>
      ) : (
        <div className="text-xs text-white/30 italic">Бросок не выполнен</div>
      )}
    </div>
  );
}
