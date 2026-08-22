'use client';

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ValidationIssue, NpcConfig, Skill, SkillGroup, NpcData, NPCAttack, SkillsConfig } from '../types';
import { Bomb, Heart, Shield, Sword } from 'lucide-react';

type Props = {
  data: Record<string, any>;
  config: NpcConfig;
  skillsConfig?: SkillsConfig;
  issues?: ValidationIssue[];
  onChange: (next: Record<string, any>) => void;
};

function normalizeIssuePath(p: string) {
  return p.startsWith('data.') ? p.slice(5) : p;
}

function asNumber(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

// ── Иконки ──────────────────────────────────────────────────────────────────

// function HeartIcon({ className }: { className?: string }) {
//   return (
//     <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
//       <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
//     </svg>
//   );
// }

// function ShieldIcon({ className }: { className?: string }) {
//   return (
//     <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
//       <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
//     </svg>
//   );
// }

// function SwordIcon({ className }: { className?: string }) {
//   return (
//     <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
//       <path d="M9.293 1.293a1 1 0 011.414 0l7 7a1 1 0 010 1.414l-7 7a1 1 0 01-1.414-1.414L14.586 10 9.293 4.707a1 1 0 010-1.414zM3 12a1 1 0 011-1h4a1 1 0 110 2H4a1 1 0 01-1-1zm-1 3a1 1 0 011-1h6a1 1 0 110 2H3a1 1 0 01-1-1z" />
//     </svg>
//   );
// }

// function BowIcon({ className }: { className?: string }) {
//   return (
//     <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
//       <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
//     </svg>
//   );
// }

// ── Компонент поля навыка с подсветкой ──────────────────────────────────────

function HighlightedSkillInput({
  skill,
  value,
  onChange,
  issue,
  accentClass,
  icon,
}: {
  skill: Skill;
  value: number;
  onChange: (v: number) => void;
  issue?: ValidationIssue;
  accentClass: string; // tailwind border/text color класс
  icon: React.ReactNode;
}) {
  const errorText = issue?.message;
  const isErr = !!errorText && (issue?.level ?? 'error') === 'error';

  return (
    <div className={`space-y-1 rounded-md border ${accentClass} bg-black/20 p-2`}>
      <div className="text-sm text-gray-300 flex justify-between gap-2 items-center">
        <span className="flex items-center gap-1.5 text-gray-200">
          {icon}
          {skill.title ?? skill.id}
          <span className="ml-1 text-xs text-gray-500">({skill.id})</span>
        </span>
        {errorText && (
          <span className={`text-xs ${isErr ? 'text-red-400' : 'text-yellow-300'}`}>{errorText}</span>
        )}
      </div>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          const vv = raw === '' ? 0 : Number(raw);
          onChange(Number.isFinite(vv) ? vv : 0);
        }}
        className={isErr ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
      />
    </div>
  );
}

// ── Основной компонент ───────────────────────────────────────────────────────

export default function NPCDataEditor({ data, config, issues, onChange }: Props) {
  useEffect(() => {
    const hasSkills = data && typeof data === 'object' && data.skills && typeof data.skills === 'object';
    if (!hasSkills && config?.initialData) onChange(structuredClone(config.initialData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const groups: SkillGroup[] = config?.skillGroups ?? [];
  const skills: Skill[] = config?.skills ?? [];

  const groupIndex = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const isGeneralGroupId = (gid: string) =>
    groupIndex.get(gid)?.kind === 'general' || groupIndex.get(gid)?.kind === 'both';

  const generalSkills = useMemo(() => skills.filter((s) => isGeneralGroupId(s.group)), [skills, groupIndex]);
  const generalGroups = useMemo(
    () => groups.filter((g) => g.kind === 'general' || g.kind === 'both'),
    [groups]
  );

  const skillsByGroup = useMemo(() => {
    return generalSkills.reduce<Record<string, Skill[]>>((acc, s) => {
      (acc[s.group] ??= []).push(s);
      return acc;
    }, {});
  }, [generalSkills]);

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const value = (data ?? {}) as NpcData;
  const currentSkills: Record<string, number> = (value.skills ?? {}) as any;

  const setRoot = (patch: Partial<NpcData>) => {
    onChange({ ...(structuredClone(value) as any), ...(patch as any) });
  };

  const setSkill = (skillId: string, v: number) => {
    const next = structuredClone(value ?? {}) as any;
    next.skills = next.skills ?? {};
    next.skills[skillId] = Math.max(0, v);
    onChange(next);
  };

  const set = (patch: Partial<NpcData>) => {
    onChange({ ...(structuredClone(value) as NpcData), ...patch });
  };

  const setAttack = (i: number, patch: Partial<NPCAttack>) => {
    const attacks = [...(value.attacks ?? [])];
    attacks[i] = { ...attacks[i], ...patch };
    set({ attacks });
  };

  const addAttack = () => {
    const attacks = [...(value.attacks ?? [])];
    attacks.push({ name: '', attack_dmg: '', attack_skill: '' });
    set({ attacks });
  };

  const removeAttack = (i: number) => {
    const attacks = (value.attacks ?? []).filter((_, j) => j !== i);
    set({ attacks });
  };

  // ── Специальные навыки из skillsConfig ────────────────────────────────────

  const healthSkillId = config?.health_skill;
  const stabilitySkillId = config?.stability_skill;
  const meleeSkillId = config?.attack_skills?.melee;
  const rangedSkillId = config?.attack_skills?.ranged;

  const specialSkillIds = useMemo(
    () => new Set([healthSkillId, stabilitySkillId, meleeSkillId, rangedSkillId].filter(Boolean)),
    [healthSkillId, stabilitySkillId, meleeSkillId, rangedSkillId]
  );

  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  // Группы и навыки без специальных
  const filteredSkillsByGroup = useMemo(() => {
    return generalSkills
      .filter((s) => !specialSkillIds.has(s.id))
      .reduce<Record<string, Skill[]>>((acc, s) => {
        (acc[s.group] ??= []).push(s);
        return acc;
      }, {});
  }, [generalSkills, specialSkillIds]);

  return (
    <div className="space-y-4">
      {/* Верх — боевые параметры */}
      <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-3">
        <details>
          <summary className="text-sm text-gray-300 cursor-pointer select-none">
            Боевые параметры (опционально)
          </summary>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <label className="space-y-1">
              <div className="text-xs text-gray-400">Hit Threshold</div>
              <Input
                type="number"
                min={0}
                value={value.hitThreshold ?? ''}
                onChange={(e) =>
                  setRoot({ hitThreshold: e.target.value === '' ? null : asNumber(e.target.value, 0) })
                }
              />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-gray-400">Armor</div>
              <Input
                type="number"
                min={0}
                value={value.armor ?? ''}
                onChange={(e) =>
                  setRoot({ armor: e.target.value === '' ? null : asNumber(e.target.value, 0) })
                }
              />
            </label>
          </div>
        </details>
      </div>

      {/* ── Специальные навыки: HP, Stability, Melee, Ranged ── */}
      {(healthSkillId || stabilitySkillId || meleeSkillId || rangedSkillId) && (
        <div className="rounded-md border border-gray-600 bg-black/20 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-700 text-sm font-semibold text-gray-100">
            Ключевые навыки
          </div>
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* HP */}
            {healthSkillId && skillMap.has(healthSkillId) && (
              <HighlightedSkillInput
                skill={skillMap.get(healthSkillId)!}
                value={Number(currentSkills?.[healthSkillId] ?? 0)}
                onChange={(v) => setSkill(healthSkillId, v)}
                issue={issueMap.get(`skills.${healthSkillId}`) || issueMap.get(`skills.${healthSkillId}.value`)}
                accentClass="border-rose-500/60"
                icon={<Heart className="w-4 h-4 text-rose-400 shrink-0" />}
              />
            )}

            {/* Stability */}
            {stabilitySkillId && skillMap.has(stabilitySkillId) && (
              <HighlightedSkillInput
                skill={skillMap.get(stabilitySkillId)!}
                value={Number(currentSkills?.[stabilitySkillId] ?? 0)}
                onChange={(v) => setSkill(stabilitySkillId, v)}
                issue={
                  issueMap.get(`skills.${stabilitySkillId}`) ||
                  issueMap.get(`skills.${stabilitySkillId}.value`)
                }
                accentClass="border-blue-500/60"
                icon={<Shield className="w-4 h-4 text-blue-400 shrink-0" />}
              />
            )}

            {/* Melee */}
            {meleeSkillId && skillMap.has(meleeSkillId) && (
              <HighlightedSkillInput
                skill={skillMap.get(meleeSkillId)!}
                value={Number(currentSkills?.[meleeSkillId] ?? 0)}
                onChange={(v) => setSkill(meleeSkillId, v)}
                issue={
                  issueMap.get(`skills.${meleeSkillId}`) ||
                  issueMap.get(`skills.${meleeSkillId}.value`)
                }
                accentClass="border-amber-500/60"
                icon={<Sword className="w-4 h-4 text-amber-400 shrink-0" />}
              />
            )}

            {/* Ranged */}
            {rangedSkillId && skillMap.has(rangedSkillId) && (
              <HighlightedSkillInput
                skill={skillMap.get(rangedSkillId)!}
                value={Number(currentSkills?.[rangedSkillId] ?? 0)}
                onChange={(v) => setSkill(rangedSkillId, v)}
                issue={
                  issueMap.get(`skills.${rangedSkillId}`) ||
                  issueMap.get(`skills.${rangedSkillId}.value`)
                }
                accentClass="border-green-500/60"
                icon={<Bomb className="w-4 h-4 text-green-400 shrink-0" />}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Остальные группы general (без специальных навыков) ── */}
      <div className="space-y-4">
        {generalGroups.map((g) => {
          const groupSkills = filteredSkillsByGroup[g.id] ?? [];
          if (!groupSkills.length) return null;

          return (
            <div key={g.id} className="rounded-md overflow-hidden border border-gray-700 bg-black/20">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: g.color ?? '#64748b' }}
                  />
                  <div className="text-sm font-semibold text-gray-100">{g.title}</div>
                </div>
                <div
                  className="text-[11px] px-2 py-0.5 rounded border border-gray-700"
                  style={{ color: g.color ?? '#94a3b8' }}
                >
                  {g.id}
                </div>
              </div>

              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupSkills.map((s) => {
                  const v = Number(currentSkills?.[s.id] ?? 0);
                  const valueNum = Number.isFinite(v) ? v : 0;

                  const issue =
                    issueMap.get(`skills.${s.id}`) || issueMap.get(`skills.${s.id}.value`);
                  const errorText = issue?.message;
                  const isErr = !!errorText && (issue?.level ?? 'error') === 'error';

                  return (
                    <div key={s.id} className="space-y-1">
                      <div className="text-sm text-gray-300 flex justify-between gap-2">
                        <span className="text-gray-200">
                          {s.title ?? s.id}
                          <span className="ml-2 text-xs text-gray-500">({s.id})</span>
                        </span>
                        {errorText && (
                          <span className={`text-xs ${isErr ? 'text-red-400' : 'text-yellow-300'}`}>
                            {errorText}
                          </span>
                        )}
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={valueNum}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const vv = raw === '' ? 0 : Number(raw);
                          setSkill(s.id, Number.isFinite(vv) ? vv : 0);
                        }}
                        className={isErr ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Атаки ── */}
      <div className="space-y-2">
        <div className="text-sm text-gray-300">Атаки</div>
        {(value.attacks ?? []).map((attack, i) => (
          <div key={i} className="rounded border border-gray-700 bg-black/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 space-y-1">
                <div className="text-xs text-gray-400">Название</div>
                <Input
                  type="text"
                  value={attack.name}
                  onChange={(e) => setAttack(i, { name: e.target.value })}
                  className="w-full"
                />
              </div>
              <div className="w-24 space-y-1">
                <div className="text-xs text-gray-400">Урон</div>
                <Input
                  type="text"
                  min={0}
                  value={attack.attack_dmg}
                  onChange={(e) => setAttack(i, { attack_dmg: e.target.value })}
                />
              </div>
              <div className="w-32 space-y-1">
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  Скилл
                  {/* Показываем иконку в зависимости от выбранного скилла */}
                  {attack.attack_skill === meleeSkillId && (
                    <Sword className="w-3 h-3 text-amber-400" />
                  )}
                  {attack.attack_skill === rangedSkillId && (
                    <Bomb className="w-3 h-3 text-green-400" />
                  )}
                </div>
                <select
                  className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
                  value={attack.attack_skill}
                  onChange={(e) => setAttack(i, { attack_skill: e.target.value as any })}
                >
                  <option value="">—</option>
                  {[
                    meleeSkillId && skillMap.get(meleeSkillId)
                      ? { id: meleeSkillId, label: `⚔ ${skillMap.get(meleeSkillId)!.title}` }
                      : null,
                    rangedSkillId && skillMap.get(rangedSkillId)
                      ? { id: rangedSkillId, label: `🏹 ${skillMap.get(rangedSkillId)!.title}` }
                      : null,
                  ]
                    .filter(Boolean)
                    .map((opt) => (
                      <option key={opt!.id} value={opt!.id}>
                        {opt!.label}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeAttack(i)}
                className="self-start text-xs text-red-400 hover:text-red-300 px-1"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addAttack}
          className="text-xs px-2 py-1 rounded border border-gray-700 bg-black/40 text-gray-200 hover:border-gray-500"
        >
          + добавить атаку
        </button>
      </div>
    </div>
  );
}