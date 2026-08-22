// plugins/gumshoe/attack/stages/AttackResultStage.tsx
'use client';
import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Sword, Skull } from 'lucide-react';
import { DiceRollDisplay } from '@/plugins/common/ui';
import { gumshoeAttackInterpreter } from './AttackRollStage';
import { damageInterpreter } from './AttackDamageStage';


function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function AttackResultStage({ user_id, action, setSubmitEnabled, onSubmit }: any) {
  const wf: any = action?.workflow ?? {};
  const ctx     = wf?.context ?? {};
  const entry   = ctx?.entry ?? {};

  const dice: number[] = Array.isArray(entry.dice) ? entry.dice : [];
  const roll = dice[0];
  const attack_value = roll + (entry.skill_points ?? 0);

  // ✅ берём из бэка, не вычисляем сами
  const isHit: boolean = entry.result_hit ?? false;

  const damageRolls: number[] = Array.isArray(entry.damage_rolls) ? entry.damage_rolls : [];
  const hasDamage = isHit && (damageRolls.length > 0 || entry.damage_total > 0);

  const isGm = String(action?.participants?.gmUserId ?? '') === String(user_id);
  const isDone = wf?.stageKey === 'completed';

  useEffect(() => {
    if (isGm && !isDone) setSubmitEnabled(true);
    else setSubmitEnabled(false);
  }, [isGm, isDone]);


  const pts = (entry?.skill_points ?? 0);
  const total = (entry?.dice?.[0] ?? 0) + pts;
  // до return
  const animKey = `${entry?.canvas_seed ?? 'no-seed'}:${(entry?.dice ?? []).join(',')}:${total}:${pts}`;
  const dmgAnimKey = `dmg:${entry?.damage_seed ?? 'no-seed'}:${damageRolls.join(',')}:${entry.damage_total}`;
  const dmgLabel = `${damageRolls.length}d6${entry.damage_modifier !== 0
    ? ` ${entry.damage_modifier > 0 ? '+' : ''}${entry.damage_modifier}`
    : ''}`;
  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <Sword className="w-4 h-4 text-red-400" />
        Результат атаки
      </div>

      {/* Сводка */}
      <div className="rounded border px-3 py-2 bg-zinc-950/30 text-sm space-y-0.5">
        <div>
          Атакующий: <span className="text-white/80">{asStr(entry.attackerCharacterName, '—')}</span>
        </div>
        <div>
          Цель: <span className="text-white/80">{asStr(entry.targetNpcName, '—')}</span>
        </div>
        <div>
          Оружие:{' '}
          <span className="text-white/80">
            {asStr(entry.weaponName, '—')} ({entry.weaponMode || '—'})
          </span>
        </div>
      </div>

      {/* Бросок атаки */}
      {dice.length > 0 && (
        <div className="rounded border px-3 py-2 bg-zinc-950/30 text-sm">
          Бросок атаки:{' '}
          <span className="font-semibold text-white">{attack_value}</span>
          <span className="text-white/40 ml-1">({roll} + {entry.skill_points ?? 0})</span>

          <DiceRollDisplay
            key={animKey}
            dice={entry?.dice}
            total={total}
            rollLabel={`1d6 + ${pts} pts`}
            interpreter={
              ({ dice }) => {
                if (!dice.length) {
                  return { dieColors: [], outcome: null };
                }
                const v = dice[0];
                const color = entry?.result_hit ? 'good' : 'bad';
                const label = entry?.result_hit ? 'Попадание' : 'Промах';
                const effect = entry?.result_text || '';
                return {
                  dieColors: [color],
                  outcome: { label, color, effect },
                };
              }
            }
            canvasSeed={entry?.canvas_seed ?? null}
            animKey={animKey}
          />
        </div>
      )}

      {/* Hit / Miss */}
      {entry.result_text && (
        <div className={`
          flex items-center gap-2 rounded border px-3 py-2 text-sm
          ${isHit
            ? 'border-green-500/40 bg-green-500/10 text-green-200'
            : 'border-red-500/40 bg-red-500/10 text-red-200'}
        `}>
          {isHit ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <div>{entry.result_text}</div>
        </div>
      )}

      {/* Урон (только при попадании) */}
      {hasDamage && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-white/50 uppercase tracking-wide">Урон</div>
          <div className="rounded border px-3 py-2 bg-zinc-950/30 text-sm">
            Кости: <span className="font-semibold text-white">
              [{damageRolls.join(', ')}]
            </span>
            {entry.damage_modifier !== 0 && (
              <span className="text-white/40 ml-1">
                {entry.damage_modifier > 0 ? '+' : ''}{entry.damage_modifier}
              </span>
            )}
            {' '}= <span className="font-semibold text-orange-300">{entry.damage_total}</span>

            {/* анимация броска урона */}
            {damageRolls.length > 0 && (() => {

              return (
                <DiceRollDisplay
                  key={dmgAnimKey}
                  dice={damageRolls}
                  total={entry.damage_total}
                  rollLabel={dmgLabel}
                  interpreter={damageInterpreter}
                  canvasSeed={entry?.damage_seed ?? null}
                  animKey={dmgAnimKey}
                />
              );
            })()}
          </div>

          {entry.damage_text && (
            <div className={`
              flex items-center gap-2 rounded border px-3 py-2 text-sm
              ${entry.damage_text.includes('повержен')
                ? 'border-red-500/50 bg-red-500/10 text-red-200'
                : 'border-orange-500/30 bg-orange-500/10 text-orange-200'}
            `}>
              {entry.damage_text.includes('повержен') && <Skull className="w-4 h-4 shrink-0" />}
              <div>{entry.damage_text}</div>
            </div>
          )}
        </div>
      )}

      {/* Кнопка GM */}
      {isGm && !isDone && (
        <button
          type="button"
          onClick={() => onSubmit({})}
          className="rounded border px-3 py-2 text-sm text-white/70 hover:border-white/40 hover:text-white/90"
        >
          Закрыть атаку
        </button>
      )}
    </div>
  );
}
