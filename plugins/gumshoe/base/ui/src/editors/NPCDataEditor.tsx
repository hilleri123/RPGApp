'use client';

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ValidationIssue, NpcConfig, Skill, SkillGroup, NpcData } from '../types';

type Props = {
  data: Record<string, any>;
  config: NpcConfig;
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

export default function NPCDataEditor({ data, config, issues, onChange }: Props) {
  useEffect(() => {
    const hasSkills = data && typeof data === 'object' && data.skills && typeof data.skills === 'object';
    if (!hasSkills && config?.initialData) onChange(structuredClone(config.initialData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const groups: SkillGroup[] = config?.skillGroups ?? [];
  const skills: Skill[] = config?.skills ?? [];

  const groupIndex = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const isGeneralGroupId = (gid: string) => groupIndex.get(gid)?.kind === 'general';

  const generalSkills = useMemo(() => skills.filter((s) => isGeneralGroupId(s.group)), [skills, groupIndex]);
  const generalGroups = useMemo(() => groups.filter((g) => g.kind === 'general'), [groups]);

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

  const totals = useMemo(() => {
    return generalSkills.reduce((sum, s) => sum + (Number(currentSkills?.[s.id]) || 0), 0);
  }, [generalSkills, currentSkills]);

  return (
    <div className="space-y-4">
      {/* Верх */}
      <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-3">
        <details>
          <summary className="text-sm text-gray-300 cursor-pointer select-none">Боевые параметры (опционально)</summary>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <label className="space-y-1">
              <div className="text-xs text-gray-400">Hit Threshold</div>
              <Input
                type="number"
                min={0}
                value={value.hitThreshold ?? ''}
                onChange={(e) => setRoot({ hitThreshold: e.target.value === '' ? null : asNumber(e.target.value, 0) })}
              />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-gray-400">Armor</div>
              <Input
                type="number"
                min={0}
                value={value.armor ?? ''}
                onChange={(e) => setRoot({ armor: e.target.value === '' ? null : asNumber(e.target.value, 0) })}
              />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-gray-400">Health</div>
              <Input
                type="number"
                min={0}
                value={value.health ?? ''}
                onChange={(e) => setRoot({ health: e.target.value === '' ? null : asNumber(e.target.value, 0) })}
              />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-gray-400">Stability</div>
              <Input
                type="number"
                min={0}
                value={value.stability ?? ''}
                onChange={(e) => setRoot({ stability: e.target.value === '' ? null : asNumber(e.target.value, 0) })}
              />
            </label>
          </div>
        </details>
      </div>

      {/* Группы general */}
      <div className="space-y-4">
        {generalGroups.map((g) => {
          const groupSkills = skillsByGroup[g.id] ?? [];
          if (!groupSkills.length) return null;

          return (
            <div key={g.id} className="rounded-md overflow-hidden border border-gray-700 bg-black/20">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color ?? '#64748b' }} />
                  <div className="text-sm font-semibold text-gray-100">{g.title}</div>
                </div>
                <div className="text-[11px] px-2 py-0.5 rounded border border-gray-700" style={{ color: g.color ?? '#94a3b8' }}>
                  {g.id}
                </div>
              </div>

              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupSkills.map((s) => {
                  const v = Number(currentSkills?.[s.id] ?? 0);
                  const valueNum = Number.isFinite(v) ? v : 0;

                  const issue =
                    issueMap.get(`skills.${s.id}`) ||
                    issueMap.get(`skills.${s.id}.value`);

                  const errorText = issue?.message;
                  const isErr = !!errorText && (issue?.level ?? 'error') === 'error';

                  return (
                    <div key={s.id} className="space-y-1">
                      <div className="text-sm text-gray-300 flex justify-between gap-2">
                        <span className="text-gray-200">
                          {s.title ?? s.id}
                          <span className="ml-2 text-xs text-gray-500">({s.id})</span>
                        </span>
                        {errorText ? (
                          <span className={`text-xs ${isErr ? 'text-red-400' : 'text-yellow-300'}`}>{errorText}</span>
                        ) : null}
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
    </div>
  );
}
