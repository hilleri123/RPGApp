// plugins/gumshoe/contest/stages/ContestSpendStage.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Crosshair, User, Bot } from 'lucide-react';
import { Input } from '@/components/ui/input';

function asStr(x: any, fb = '') {
  return String(x ?? '').trim() || fb;
}

export function ContestSpendStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const wf           = action?.workflow ?? {};
  const ctx          = wf?.context ?? {};
  const entry        = ctx?.entry ?? {};
  const scene        = action?.scene?.scene ?? {};
  const participants = action?.participants ?? {};
  const skills: any[] = ctx?.skills ?? [];

  const isGm = String(participants?.gmUserId ?? '') === String(user_id);

  const sideA = entry?.side_a ?? {};
  const sideB = entry?.side_b ?? {};
  const skillId: string = entry?.skill_id ?? '';

  const selectedSkill = useMemo(() => skills.find((s: any) => s.id === skillId) ?? null, [skills, skillId]);

  // ── Определяем свою сторону ───────────────────────────────────────────────
  const mySideKey: 'a' | 'b' | null = useMemo(() => {
    // Игрок — ищем по userId
    if (!isGm) {
      if (sideA?.userId && String(sideA.userId) === String(user_id) && !sideA.points_set) return 'a';
      if (sideB?.userId && String(sideB.userId) === String(user_id) && !sideB.points_set) return 'b';
      return null;
    }
    // GM управляет NPC и пустыми сторонами
    if (!sideA.points_set && (sideA?.npcId || (!sideA?.characterId && !sideA?.npcId))) return 'a';
    if (!sideB.points_set && (sideB?.npcId || (!sideB?.characterId && !sideB?.npcId))) return 'b';
    return null;
  }, [isGm, sideA, sideB, user_id]);

  // ── Доступные поинты у своей стороны ─────────────────────────────────────
  
  const spentBefore = useMemo(() => {
    const rounds: any[] = entry?.rounds ?? [];

    return rounds.reduce((sum, r: any) => {
      const side = mySideKey === 'a' ? r?.side_a : r?.side_b;
      if (!side) return sum;

      // если у тебя rounds хранят spent отдельно — подставь это поле
      const spent = Number(side?.skill_points ?? 0);
      return sum + (Number.isFinite(spent) ? spent : 0);
    }, 0);
  }, [entry?.rounds, mySideKey]);


  const availablePts: number = useMemo(() => {
    if (!skillId || !mySideKey) return 0;

    const side = mySideKey === 'a' ? sideA : sideB;
    let base = 0;

    if (side?.characterId) {
      const ch = (scene?.characters ?? []).find((c: any) => c.id === side.characterId);
      base = ch?.data?.skills?.[skillId] ?? 0;
    } else if (side?.npcId) {
      const npc = (scene?.npcs ?? []).find((n: any) => n.id === side.npcId);
      base = npc?.data?.skills?.[skillId] ?? 0;
    }

    return Math.max(0, base - spentBefore);
  }, [skillId, mySideKey, sideA, sideB, scene, spentBefore]);


  const [skillPoints, setSkillPoints] = useState<number>(value?.skill_points ?? 0);

  // Защищаем от превышения при изменении availablePts
  useEffect(() => {
    if (skillPoints > availablePts) setSkillPoints(availablePts);
  }, [availablePts]);

  useEffect(() => {
    setSubmitEnabled(!!mySideKey);
  }, [mySideKey, setSubmitEnabled]);

  const handleSubmit = () => {
    if (!mySideKey) return;
    onSubmit({ skill_points: skillPoints });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <Crosshair className="w-4 h-4 text-red-400" />
        Состязание: поинты
        {selectedSkill && (
          <span className="text-xs text-white/40 font-normal normal-case">
            — {selectedSkill.title}
          </span>
        )}
      </div>

      {/* ── Карточки сторон ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <SideCard sideKey="a" side={sideA} mySideKey={mySideKey} />
        <SideCard sideKey="b" side={sideB} mySideKey={mySideKey} />
      </div>

      {/* ── Ввод поинтов ── */}
      {mySideKey ? (
        <div className="rounded border border-yellow-400/30 bg-yellow-500/5 p-3 flex flex-col gap-3">
          <div className="text-xs text-yellow-300/70 uppercase tracking-wide">
            Вы играете за сторону {mySideKey.toUpperCase()}
          </div>

          <div className="text-sm text-white/80">
            Укажите, сколько поинтов потратить. Другая сторона не увидит ваш выбор.
          </div>

          {/* Доступно */}
          <div className="text-xs text-white/50">
            Доступно по скиллу «{selectedSkill?.title ?? skillId}»:{' '}
            <span className="text-white/80 font-semibold">{availablePts} pts</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSkillPoints((v) => Math.max(0, v - 1))}
              className="rounded border border-white/20 px-3 py-1.5 text-sm hover:border-white/40"
            >
              −
            </button>

            <Input
              type="number"
              min={0}
              max={availablePts}
              value={skillPoints}
              onChange={(e) => setSkillPoints(Math.min(availablePts, Math.max(0, Number(e.target.value))))}
              className="w-24 text-center"
            />

            <button
              type="button"
              onClick={() => setSkillPoints((v) => Math.min(availablePts, v + 1))}
              className="rounded border border-white/20 px-3 py-1.5 text-sm hover:border-white/40"
            >
              +
            </button>

            {/* Визуальная шкала */}
            {availablePts > 0 && (
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-yellow-400 transition-all"
                  style={{ width: `${(skillPoints / availablePts) * 100}%` }}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            className="rounded border border-yellow-400/70 text-yellow-200 px-3 py-2 text-sm font-semibold hover:bg-yellow-500/10"
          >
            Подтвердить
          </button>
        </div>
      ) : (
        <div className="rounded border border-white/10 p-3 text-sm text-white/40">
          Вы не участник этого шага или уже указали поинты.
        </div>
      )}
    </div>
  );
}

// ── SideCard ──────────────────────────────────────────────────────────────

function SideCard({ sideKey, side, mySideKey }: {
  sideKey: 'a' | 'b';
  side: any;
  mySideKey: 'a' | 'b' | null;
}) {
  const isMine  = mySideKey === sideKey;
  const kind    = side?.characterId ? 'character' : side?.npcId ? 'npc' : 'none';
  const isDone  = !!side?.points_set;

  return (
    <div className={`
      rounded border p-3 flex flex-col gap-1.5 transition-colors
      ${isMine
        ? 'border-yellow-400/50 bg-yellow-500/5'
        : 'border-white/10'}
    `}>
      <div className="flex items-center justify-between">
        <div className={`text-xs uppercase tracking-wide font-semibold ${isMine ? 'text-yellow-300' : 'text-white/50'}`}>
          Сторона {sideKey.toUpperCase()}
          {isMine && <span className="ml-1.5 normal-case font-normal text-yellow-300/60">(вы)</span>}
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
        {String(side?.name ?? '—')}
      </div>

      <div className="text-xs text-white/40">
        {kind === 'character' ? 'Персонаж' : kind === 'npc' ? 'NPC' : 'Никого'}
      </div>
    </div>
  );
}
