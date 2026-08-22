// plugins/gumshoe/contest/stages/ContestRollStage.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dice6, User, Bot } from 'lucide-react';
import { CanvasSeed, DiceRollDisplay, DiceInterpreter } from '@/plugins/common/ui';

function asStr(x: any, fb = '') {
  return String(x ?? '').trim() || fb;
}

const contestInterpreter: DiceInterpreter = ({ dice }) => {
  if (!dice.length) return { dieColors: [], outcome: null };
  const v = dice[0];
  return {
    dieColors: [v >= 4 ? 'good' : 'bad'],
    outcome: {
      label: v >= 4 ? 'Удачный бросок' : 'Неудачный бросок',
      color: v >= 4 ? 'good' : 'bad',
      effect: '',
    },
  };
};

export function ContestRollStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const wf           = action?.workflow ?? {};
  const ctx          = wf?.context ?? {};
  const entry        = ctx?.entry ?? {};
  const participants = action?.participants ?? {};
  const skills: any[] = ctx?.skills ?? [];
  const isGm = String(participants?.gmUserId ?? '') === String(user_id);

  const sideA = entry?.side_a ?? {};
  const sideB = entry?.side_b ?? {};
  const skillId: string = entry?.skill_id ?? '';

  const selectedSkill = useMemo(() => skills.find((s: any) => s.id === skillId) ?? null, [skills, skillId]);
  const bothRolled = sideA?.roll_total != null && sideB?.roll_total != null;

  // ── Определяем свою сторону (как в SpendStage) ────────────────────────────
  const mySideKey: 'a' | 'b' | null = useMemo(() => {
    if (!isGm) {
      if (sideA?.userId && String(sideA.userId) === String(user_id) && sideA?.roll_total == null) return 'a';
      if (sideB?.userId && String(sideB.userId) === String(user_id) && sideB?.roll_total == null) return 'b';
      return null;
    }
    if (sideA?.roll_total == null && (sideA?.npcId || (!sideA?.characterId && !sideA?.npcId))) return 'a';
    if (sideB?.roll_total == null && (sideB?.npcId || (!sideB?.characterId && !sideB?.npcId))) return 'b';
    return null;
  }, [isGm, sideA, sideB, user_id]);

  const [seed, setSeed] = useState<string | null>(null);

  useEffect(() => {
    setSubmitEnabled(!!seed && !!mySideKey);
  }, [seed, mySideKey, setSubmitEnabled]);

  const handleSeedChange = (s: string | null) => {
    setSeed(s);
    patch({ canvas_seed: s });
  };

  const handleSubmit = () => {
    if (!seed || !mySideKey) return;
    onSubmit({ canvas_seed: seed });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <Dice6 className="w-4 h-4 text-orange-400" />
        Состязание: бросок
        {selectedSkill && (
          <span className="text-xs text-white/40 font-normal normal-case">
            — {selectedSkill.title}
          </span>
        )}
      </div>

      {/* ── Карточки сторон ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <RollSideCard sideKey="a" side={sideA} mySideKey={mySideKey} bothRolled={bothRolled} />
        <RollSideCard sideKey="b" side={sideB} mySideKey={mySideKey} bothRolled={bothRolled} />
      </div>

      {/* ── Ввод броска ── */}
      {mySideKey && !bothRolled ? (
        <div className="rounded border border-orange-400/30 bg-orange-500/5 p-3 flex flex-col gap-3">
          <div className="text-xs text-orange-300/70 uppercase tracking-wide">
            Бросок за сторону {mySideKey.toUpperCase()}
          </div>
          <div className="text-sm text-white/70">
            Нарисуй seed — он определит результат d6.
          </div>

          <CanvasSeed
            onChange={handleSeedChange}
            hint="Нарисуй seed для броска 1d6 + поинты."
          />

          <button
            type="button"
            disabled={!seed}
            onClick={handleSubmit}
            className={`
              rounded border px-3 py-2 text-sm font-semibold
              ${seed
                ? 'border-orange-400/70 text-orange-200 hover:bg-orange-500/10'
                : 'border-white/10 text-white/30 cursor-not-allowed'}
            `}
          >
            Бросить d6
          </button>
        </div>
      ) : !mySideKey && !bothRolled ? (
        <div className="rounded border border-white/10 p-3 text-sm text-white/40">
          Ожидание броска другой стороны…
        </div>
      ) : null}

      {/* ── Результаты — только когда оба бросили ── */}
      {bothRolled && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-white/50 uppercase tracking-wide">Результаты</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <DiceResultCard sideKey="a" side={sideA} />
            <DiceResultCard sideKey="b" side={sideB} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── RollSideCard ─────────────────────────────────────────────────────────────

function RollSideCard({ sideKey, side, mySideKey, bothRolled }: {
  sideKey: 'a' | 'b';
  side: any;
  mySideKey: 'a' | 'b' | null;
  bothRolled: boolean;
}) {
  const isMine  = mySideKey === sideKey;
  const isDone  = side?.roll_total != null;
  const kind    = side?.characterId ? 'character' : side?.npcId ? 'npc' : 'none';

  return (
    <div className={`
      rounded border p-3 flex flex-col gap-1.5 transition-colors
      ${isMine ? 'border-orange-400/50 bg-orange-500/5' : 'border-white/10'}
    `}>
      <div className="flex items-center justify-between">
        <div className={`text-xs uppercase tracking-wide font-semibold ${isMine ? 'text-orange-300' : 'text-white/50'}`}>
          Сторона {sideKey.toUpperCase()}
          {isMine && <span className="ml-1.5 normal-case font-normal text-orange-300/60">(вы)</span>}
        </div>
        <div className={`text-xs rounded px-1.5 py-0.5 border ${
          isDone
            ? 'border-green-400/30 bg-green-500/10 text-green-300'
            : 'border-white/10 text-white/40'
        }`}>
          {isDone ? 'готово' : 'ждёт'}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-sm font-semibold">
        {kind === 'character' && <User className="w-3.5 h-3.5 text-blue-400" />}
        {kind === 'npc'       && <Bot  className="w-3.5 h-3.5 text-red-400"  />}
        {asStr(side?.name, '—')}
      </div>

      <div className="text-xs text-white/50">
        Поинты: {side?.skill_points ?? 0}
      </div>

      {/* Результат до финала скрыт */}
      {isDone && !bothRolled && (
        <div className="text-xs text-white/30 italic">Результат скрыт до броска второй стороны</div>
      )}
    </div>
  );
}

// ── DiceResultCard ────────────────────────────────────────────────────────────

function DiceResultCard({ sideKey, side }: { sideKey: 'a' | 'b'; side: any }) {
  const roll   = side?.dice?.[0] ?? 0;
  const pts    = side?.skill_points ?? 0;
  const total  = side?.roll_total ?? 0;

  return (
    <div className="rounded border border-white/10 p-3 flex flex-col gap-1.5">
      <div className="font-semibold text-sm">Сторона {sideKey.toUpperCase()} — {asStr(side?.name, '—')}</div>
      <div className="text-xs text-white/50">
        d6: <span className="text-white/80 font-semibold">{roll}</span>
        {' '}+ поинты: <span className="text-white/80 font-semibold">{pts}</span>
        {' '}= <span className="text-white font-bold text-base">{total}</span>
      </div>
    </div>
  );
}
