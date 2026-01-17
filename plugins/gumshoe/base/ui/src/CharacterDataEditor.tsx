'use client';

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';

type Issue = { path: string; message: string; level?: 'error' | 'warning' };

type SkillGroup = { id: string; title: string; color?: string };
type Skill = { id: string; title: string; group: string };

type CharacterEditorConfig = {
  skillGroups: SkillGroup[];
  skills: Skill[];
  constraints?: { maxSkillPoints?: number };
  initialData?: any;
};

type Props = {
  data: Record<string, any>;
  config: CharacterEditorConfig;
  issues?: Issue[];
  onChange: (next: Record<string, any>) => void;
};

function normalizeIssuePath(p: string) {
  return p.startsWith('data.') ? p.slice(5) : p;
}

function alpha(hex: string, a: number) {
  // hex "#rrggbb" -> "rgba(r,g,b,a)"
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export default function CharacterDataEditor({ data, config, issues, onChange }: Props) {
  useEffect(() => {
    const hasSkills = data && typeof data === 'object' && data.skills && typeof data.skills === 'object';
    if (!hasSkills && config?.initialData) onChange(structuredClone(config.initialData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const skillGroups = config?.skillGroups ?? [];
  const skills = config?.skills ?? [];
  const maxSkillPoints = config?.constraints?.maxSkillPoints;

  const skillTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of skills) m.set(s.id, s.title);
    return m;
  }, [skills]);

  const skillsByGroup = useMemo(() => {
    return skills.reduce<Record<string, Skill[]>>((acc, s) => {
      (acc[s.group] ??= []).push(s);
      return acc;
    }, {});
  }, [skills]);

  const issueMap = useMemo(() => {
    const m = new Map<string, Issue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const currentSkills: Record<string, number> = (data?.skills ?? {}) as any;

  const totalPoints = useMemo(() => {
    return skills.reduce((sum, s) => sum + (Number(currentSkills?.[s.id]) || 0), 0);
  }, [skills, currentSkills]);

  const overLimit = typeof maxSkillPoints === 'number' ? totalPoints > maxSkillPoints : false;

  const setSkill = (skillId: string, value: number | null) => {
    const next = structuredClone(data ?? {});
    next.skills = next.skills ?? {};
    next.skills[skillId] = value ?? 0;
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Хедер */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-300">Навыки</div>
        <div className={`text-sm ${overLimit ? 'text-red-400' : 'text-gray-300'}`}>
          Очки: {totalPoints}
          {typeof maxSkillPoints === 'number' ? ` / ${maxSkillPoints}` : ''}
        </div>
      </div>

      {overLimit ? <div className="text-red-400 text-xs">Превышен лимит очков навыков.</div> : null}

      {/* Группы */}
      <div className="space-y-4">
        {skillGroups.map((g) => {
          const groupSkills = skillsByGroup[g.id] ?? [];
          if (!groupSkills.length) return null;

          const color = g.color ?? '#64748b'; // slate-ish
          const bg = alpha(color, 0.10);
          const border = alpha(color, 0.35);

          return (
            <div
              key={g.id}
              className="rounded-md overflow-hidden border"
              style={{ borderColor: border ?? '#374151', backgroundColor: bg ?? 'rgba(0,0,0,0.15)' }}
            >
              {/* цветная шапка */}
              <div className="px-3 py-2 border-b flex items-center justify-between"
                   style={{ borderColor: border ?? '#374151' }}>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <div className="text-sm font-semibold text-gray-100">{g.title}</div>
                </div>

                <div className="text-[11px] px-2 py-0.5 rounded border"
                     style={{ borderColor: border ?? '#374151', color }}>
                  {g.id}
                </div>
              </div>

              {/* скиллы */}
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupSkills.map((s) => {
                  const value = Number(currentSkills?.[s.id] ?? 0);

                  const issue =
                    issueMap.get(`skills.${s.id}`) ||
                    issueMap.get(`skills.${s.id}.value`);

                  const errorText = issue?.message;
                  const isErr = !!errorText && (issue?.level ?? 'error') === 'error';

                  return (
                    <div key={s.id} className="space-y-1">
                      <div className="text-sm text-gray-300 flex justify-between gap-2">
                        <span className="text-gray-200">
                          {skillTitleById.get(s.id) ?? s.id}
                          <span className="ml-2 text-xs text-gray-500">({s.id})</span>
                        </span>
                        {errorText ? (
                          <span className={`text-xs ${isErr ? 'text-red-400' : 'text-yellow-300'}`}>
                            {errorText}
                          </span>
                        ) : null}
                      </div>

                      <Input
                        type="number"
                        value={Number.isFinite(value) ? value : 0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const v = raw === '' ? 0 : Number(raw);
                          setSkill(s.id, Number.isFinite(v) ? v : 0);
                        }}
                        className={isErr ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
                        style={
                          !isErr
                            ? {
                                borderColor: border ?? undefined,
                                boxShadow: 'none',
                              }
                            : undefined
                        }
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
