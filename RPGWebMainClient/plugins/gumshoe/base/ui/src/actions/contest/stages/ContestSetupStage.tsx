// plugins/gumshoe/contest/stages/ContestSetupStage.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Crosshair, User, Bot } from 'lucide-react';
import { Skill, SkillGroup } from '../../../types';
import { Input } from '@/components/ui/input';

function asStr(x: any, fb = '') {
  return String(x ?? '').trim() || fb;
}

export function ContestSetupStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const wf           = action?.workflow ?? {};
  const ctx          = wf?.context ?? {};
  const scene        = action?.scene?.scene ?? {};
  const participants = action?.participants ?? {};

  const isGm = String(participants?.gmUserId ?? '') === String(user_id);

  const chars: any[]       = scene?.characters ?? [];
  const npcs: any[]        = scene?.npcs ?? [];
  const skills: Skill[]      = ctx?.skills ?? [];
  const skillGroups: SkillGroup[] = ctx?.skillGroups ?? [];

  // ── State ─────────────────────────────────────────────────────────────────
  const [skillId, setSkillId] = useState<string>(value?.skill_id ?? '');

  const [sideAKind, setSideAKind] = useState<'character' | 'npc'>(value?.side_a_kind ?? 'character');
  const [sideACharId, setSideACharId] = useState<string>(value?.side_a_character_id ?? '');
  const [sideANpcId,  setSideANpcId]  = useState<string>(value?.side_a_npc_id ?? '');

  const [sideBMode, setSideBMode] = useState<'character' | 'npc' | 'none'>(value?.side_b_mode ?? 'none');
  const [sideBCharId, setSideBCharId] = useState<string>(value?.side_b_character_id ?? '');
  const [sideBNpcId,  setSideBNpcId]  = useState<string>(value?.side_b_npc_id ?? '');

  const [sideADifficulty, setSideADifficulty] = useState<number>(value?.side_a_difficulty ?? 4);
  const [sideBDifficulty, setSideBDifficulty] = useState<number>(value?.side_b_difficulty ?? 4);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const groupById = useMemo(() => {
    const m: Record<string, any> = {};
    for (const g of skillGroups) {
      if (g.kind == "investigative") continue;
      m[g.id] = g;
    }
    return m;
  }, [skillGroups]);

  const skillsGrouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const sk of skills) {
      const g = sk.group ?? 'other';
      if (!groupById[g]) continue;
      if (!map[g]) map[g] = [];
      map[g].push(sk);
    }
    return map;
  }, [skills, groupById]);

  const selectedSkill = useMemo(() => skills.find((s: any) => s.id === skillId) ?? null, [skills, skillId]);
  const selectedGroup = selectedSkill ? groupById[selectedSkill.group] : null;

  // Поинты стороны A
  const sideAPoints: number | null = useMemo(() => {
    if (!skillId) return null;
    if (sideAKind === 'character' && sideACharId) {
      const ch = chars.find((c: any) => c.id === sideACharId);
      return ch?.data?.skills?.[skillId] ?? 0;
    }
    if (sideAKind === 'npc' && sideANpcId) {
      const npc = npcs.find((n: any) => n.id === sideANpcId);
      return npc?.data?.skills?.[skillId] ?? 0;
    }
    return null;
  }, [skillId, sideAKind, sideACharId, sideANpcId, chars, npcs]);

  // Поинты стороны B
  const sideBPoints: number | null = useMemo(() => {
    if (!skillId || sideBMode === 'none') return null;
    if (sideBMode === 'character' && sideBCharId) {
      const ch = chars.find((c: any) => c.id === sideBCharId);
      return ch?.data?.skills?.[skillId] ?? 0;
    }
    if (sideBMode === 'npc' && sideBNpcId) {
      const npc = npcs.find((n: any) => n.id === sideBNpcId);
      return npc?.data?.skills?.[skillId] ?? 0;
    }
    return null;
  }, [skillId, sideBMode, sideBCharId, sideBNpcId, chars, npcs]);

  // ── Validation ────────────────────────────────────────────────────────────
  const sideAOk = sideAKind === 'character' ? !!sideACharId : !!sideANpcId;
  const isReady = isGm && !!skillId && sideAOk;

  useEffect(() => { setSubmitEnabled(isReady); }, [isReady, setSubmitEnabled]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!isReady) return;
    onSubmit({
      skill_id: skillId,

      side_a_character_id: sideAKind === 'character' ? sideACharId || undefined : undefined,
      side_a_npc_id:       sideAKind === 'npc'       ? sideANpcId  || undefined : undefined,
      side_a_difficulty:   sideADifficulty,

      side_b_character_id: sideBMode === 'character' ? sideBCharId || undefined : undefined,
      side_b_npc_id:       sideBMode === 'npc'       ? sideBNpcId  || undefined : undefined,
      side_b_difficulty:   sideBDifficulty,

      side_b_none:         sideBMode === 'none',
    });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <Crosshair className="w-4 h-4 text-red-400" />
        Состязание: настройка
      </div>

      {/* ── Скилл ── */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-white/50 uppercase tracking-wide">Скилл состязания</div>

        <div className="flex flex-col gap-2">
          {Object.entries(skillsGrouped).map(([groupId, groupSkills]) => {
            const group = groupById[groupId];
            const color = group?.color ?? '#888';
            return (
              <div key={groupId}>
                {/* Заголовок группы */}
                <div
                  className="text-xs font-semibold uppercase tracking-wide mb-1 px-1"
                  style={{ color }}
                >
                  {group?.title ?? groupId}
                </div>

                {/* Скиллы группы */}
                <div className="flex flex-wrap gap-1.5">
                  {(groupSkills as any[]).map((sk: any) => {
                    const isActive = skillId === sk.id;
                    return (
                      <button
                        key={sk.id}
                        type="button"
                        onClick={() => setSkillId(sk.id)}
                        style={{
                          borderColor: isActive ? color : 'rgba(255,255,255,0.15)',
                          backgroundColor: isActive ? `${color}18` : 'transparent',
                          color: isActive ? color : 'rgba(255,255,255,0.7)',
                        }}
                        className="rounded border px-2.5 py-1 text-xs transition-colors hover:opacity-90"
                      >
                        {sk.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Выбранный скилл */}
        {selectedSkill && (
          <div
            className="rounded border px-3 py-1.5 text-sm mt-1"
            style={{ borderColor: `${selectedGroup?.color ?? '#888'}44`, color: selectedGroup?.color ?? '#aaa' }}
          >
            Выбрано: <span className="font-semibold">{selectedSkill.title}</span>
            <span className="text-white/30 ml-1 text-xs">({selectedGroup?.title ?? selectedSkill.group})</span>
          </div>
        )}
      </div>

      {/* ── Стороны ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SidePanel
          sideLabel="A"
          kind={sideAKind}
          onKindChange={(k: any) => { setSideAKind(k as any); setSideACharId(''); setSideANpcId(''); }}
          charId={sideACharId}
          npcId={sideANpcId}
          onCharChange={setSideACharId}
          onNpcChange={setSideANpcId}
          chars={chars}
          npcs={npcs}
          skillPts={sideAPoints}
          selectedSkill={selectedSkill}
          selectedGroup={selectedGroup}
          showNone={false}
          difficulty={sideADifficulty}
          onDifficultyChange={setSideADifficulty}
        />

        <SidePanel
          sideLabel="B"
          kind={sideBMode}
          onKindChange={(k: any) => { setSideBMode(k as any); setSideBCharId(''); setSideBNpcId(''); }}
          charId={sideBCharId}
          npcId={sideBNpcId}
          onCharChange={setSideBCharId}
          onNpcChange={setSideBNpcId}
          chars={chars}
          npcs={npcs}
          skillPts={sideBPoints}
          selectedSkill={selectedSkill}
          selectedGroup={selectedGroup}
          showNone={true}
          difficulty={sideBDifficulty}
          onDifficultyChange={setSideBDifficulty}
        />
      </div>

      <button
        type="button"
        disabled={!isReady}
        onClick={handleSubmit}
        className={`
          rounded border px-3 py-2 text-sm font-semibold mt-1
          ${isReady
            ? 'border-red-400/70 text-red-200 hover:bg-red-500/10'
            : 'border-white/10 text-white/30 cursor-not-allowed'}
        `}
      >
        Начать состязание
      </button>
    </div>
  );
}

// ── SidePanel ──────────────────────────────────────────────────────────────

function SidePanel({
  sideLabel, kind, onKindChange,
  charId, npcId, onCharChange, onNpcChange,
  chars, npcs,
  skillPts, selectedSkill, selectedGroup,
  difficulty, onDifficultyChange,
  showNone,
}: any) {
  const btnBase = 'rounded border px-3 py-1.5 text-sm transition-colors';

  const selectedChar = chars.find((c: any) => c.id === charId) ?? null;
  const selectedNpc  = npcs.find((n: any) => n.id === npcId) ?? null;
  const participant  = kind === 'character' ? selectedChar : kind === 'npc' ? selectedNpc : null;

  return (
    <div className="rounded border border-white/10 p-3 flex flex-col gap-2">
      <div className="text-xs text-white/50 uppercase tracking-wide">
        Сторона {sideLabel}
      </div>

      {/* Тип участника */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onKindChange('character')}
          className={`${btnBase} flex items-center gap-1.5 ${
            kind === 'character' ? 'border-blue-400 bg-blue-500/10 text-blue-200' : 'border-white/20 text-white/70'
          }`}
        >
          <User className="w-3.5 h-3.5" /> Персонаж
        </button>
        <button
          type="button"
          onClick={() => onKindChange('npc')}
          className={`${btnBase} flex items-center gap-1.5 ${
            kind === 'npc' ? 'border-red-400 bg-red-500/10 text-red-200' : 'border-white/20 text-white/70'
          }`}
        >
          <Bot className="w-3.5 h-3.5" /> NPC
        </button>
        {showNone && (
          <button
            type="button"
            onClick={() => onKindChange('none')}
            className={`${btnBase} ${
              kind === 'none' ? 'border-white/50 bg-white/5 text-white' : 'border-white/20 text-white/70'
            }`}
          >
            Никого
          </button>
        )}
      </div>

      {/* Список персонажей */}
      {kind === 'character' && (
        <div className="flex flex-col gap-1">
          {chars.map((ch: any) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => onCharChange(ch.id)}
              className={`text-left rounded border px-3 py-2 text-sm transition-colors ${
                charId === ch.id
                  ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                  : 'border-white/20 hover:border-white/40 text-white/80'
              }`}
            >
              <div className="font-semibold">{asStr(ch.name, 'Персонаж')}</div>
            </button>
          ))}
          {chars.length === 0 && (
            <div className="text-xs text-white/40">Нет персонажей</div>
          )}
        </div>
      )}

      {/* Список NPC */}
      {kind === 'npc' && (
        <div className="flex flex-col gap-1">
          {npcs.map((n: any) => {
            const isEnemy = n.tags?.includes('enemy');
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => onNpcChange(n.id)}
                className={`text-left rounded border px-3 py-2 text-sm transition-colors
                  ${isEnemy ? 'bg-red-500/5' : 'bg-green-500/5'}
                  ${npcId === n.id
                    ? 'border-blue-400 text-blue-200'
                    : 'border-white/20 hover:border-white/40 text-white/80'}
                `}
              >
                <div className="font-semibold">{asStr(n.name, 'NPC')}</div>
              </button>
            );
          })}
          {npcs.length === 0 && (
            <div className="text-xs text-white/40">Нет NPC</div>
          )}
        </div>
      )}

      {kind === 'none' && (
        <div className="text-sm text-white/40">Вторая сторона отсутствует.</div>
      )}

      {/* ── Поинты по скиллу ── */}
      {participant && selectedSkill && (
        <div
          className="rounded border px-3 py-2 text-sm mt-1 flex items-center justify-between"
          style={{
            borderColor: `${selectedGroup?.color ?? '#888'}44`,
            backgroundColor: `${selectedGroup?.color ?? '#888'}10`,
          }}
        >
          <div className="text-white/60 text-xs">
            {selectedSkill.title}
          </div>
          <div
            className="text-lg font-bold tabular-nums"
            style={{ color: selectedGroup?.color ?? '#aaa' }}
          >
            {skillPts ?? 0}
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <label className="text-xs text-white/50 whitespace-nowrap">Сложность</label>
        <Input
          type="number"
          min={0}
          value={difficulty}
          onChange={(e) => {
            const v = Number(e.target.value);
            onDifficultyChange(Number.isFinite(v) && v >= 0 ? v : 4);
          }}
          className="w-20 text-sm"
        />
      </div>
    </div>
  );
}
