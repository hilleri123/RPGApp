'use client';

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ValidationIssue, CharacterConfig, Skill } from '../types';

type Props = {
  data: Record<string, any>;
  config: CharacterConfig;
  issues?: ValidationIssue[];
  onChange: (next: Record<string, any>) => void;
};

function normalizeIssuePath(p: string) {
  return p.startsWith('data.') ? p.slice(5) : p;
}

function alpha(hex: string, a: number) {
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
    const hasObject = data && typeof data === 'object';
    if (!hasObject && config?.initialData) {
      onChange(structuredClone(config.initialData));
      return;
    }

    const hasPoints = hasObject && data.points && typeof data.points === 'object';
    if (!hasPoints && config?.initialData) {
      const next = structuredClone(hasObject ? data : {});
      next.points = structuredClone(config.initialData.points);
      onChange(next);
      return;
    }

    if (!hasPoints) {
      const next = structuredClone(hasObject ? data : {});
      next.points = {
        investigativeMax: Number(config?.constraints?.defaultInvestigativePoints ?? 0),
        generalMax: Number(config?.constraints?.defaultGeneralPoints ?? 0),
      };
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const skillGroups = config?.skillGroups ?? [];
  const skills = config?.skills ?? [];

  const groupKindById = useMemo(() => {
    const m = new Map<string, 'investigative' | 'general'>();
    for (const g of skillGroups) m.set(g.id, g.kind);
    return m;
  }, [skillGroups]);

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const currentSkills: Record<string, number> = (data?.skills ?? {}) as any;

  const totals = useMemo(() => {
    let investigativeTotal = 0;
    let generalTotal = 0;

    for (const s of skills) {
      const v = Number(currentSkills?.[s.id]) || 0;
      const kind = groupKindById.get(s.group); // <-- ключевая правка
      if (kind === 'investigative') investigativeTotal += v;
      else if (kind === 'general') generalTotal += v;
    }

    return { investigativeTotal, generalTotal };
  }, [skills, currentSkills, groupKindById]);

  const points = data?.points ?? {};
  const investigativeMax = Number(points.investigativeMax ?? config?.constraints?.defaultInvestigativePoints ?? 0);
  const generalMax = Number(points.generalMax ?? config?.constraints?.defaultGeneralPoints ?? 0);

  const invOver = Number.isFinite(investigativeMax) ? totals.investigativeTotal > investigativeMax : false;
  const genOver = Number.isFinite(generalMax) ? totals.generalTotal > generalMax : false;

  const setSkill = (skillId: string, value: number | null) => {
    const next = structuredClone(data ?? {});
    next.skills = next.skills ?? {};
    next.skills[skillId] = value ?? 0;
    onChange(next);
  };

  const setPoints = (patch: Partial<{ investigativeMax: number; generalMax: number }>) => {
    const next = structuredClone(data ?? {});
    next.points = next.points ?? {
      investigativeMax: Number(config?.constraints?.defaultInvestigativePoints ?? 0),
      generalMax: Number(config?.constraints?.defaultGeneralPoints ?? 0),
    };
    if (patch.investigativeMax != null) next.points.investigativeMax = Math.max(0, Number(patch.investigativeMax) || 0);
    if (patch.generalMax != null) next.points.generalMax = Math.max(0, Number(patch.generalMax) || 0);
    onChange(next);
  };

  const skillsByGroup = useMemo(() => {
    return skills.reduce<Record<string, Skill[]>>((acc, s) => {
      (acc[s.group] ??= []).push(s);
      return acc;
    }, {});
  }, [skills]);

  return (
    <div className="space-y-4">
      {/* Хедер + бюджеты */}
      <div className="space-y-2">
        <div className="text-sm text-gray-300">Навыки</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded border border-gray-700 p-3 space-y-2">
            <div className={`text-sm ${invOver ? 'text-red-400' : 'text-gray-300'}`}>
              Investigative: {totals.investigativeTotal} / {investigativeMax}
            </div>
            <div className="text-xs text-gray-500">Лимит задаёт мастер</div>
            <Input
              type="number"
              min={0}
              value={Number.isFinite(investigativeMax) ? investigativeMax : 0}
              onChange={(e) => setPoints({ investigativeMax: Number(e.target.value || 0) })}
              className={invOver ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
            />
            {invOver ? <div className="text-red-400 text-xs">Превышен лимит investigative.</div> : null}
          </div>

          <div className="rounded border border-gray-700 p-3 space-y-2">
            <div className={`text-sm ${genOver ? 'text-red-400' : 'text-gray-300'}`}>
              General: {totals.generalTotal} / {generalMax}
            </div>
            <div className="text-xs text-gray-500">Лимит задаёт мастер</div>
            <Input
              type="number"
              min={0}
              value={Number.isFinite(generalMax) ? generalMax : 0}
              onChange={(e) => setPoints({ generalMax: Number(e.target.value || 0) })}
              className={genOver ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
            />
            {genOver ? <div className="text-red-400 text-xs">Превышен лимит general.</div> : null}
          </div>
        </div>
      </div>

      {/* Группы */}
      <div className="space-y-4">
        {skillGroups.map((g) => {
          const groupSkills = skillsByGroup[g.id] ?? [];
          if (!groupSkills.length) return null;

          const color = g.color ?? '#64748b';
          const bg = alpha(color, 0.1);
          const border = alpha(color, 0.35);

          return (
            <div
              key={g.id}
              className="rounded-md overflow-hidden border"
              style={{ borderColor: border ?? '#374151', backgroundColor: bg ?? 'rgba(0,0,0,0.15)' }}
            >
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: border ?? '#374151' }}>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <div className="text-sm font-semibold text-gray-100">{g.title}</div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className="text-[11px] px-2 py-0.5 rounded border"
                    style={{ borderColor: border ?? '#374151', color }}
                    title="group id"
                  >
                    {g.id}
                  </div>
                  <div className="text-[11px] text-gray-400" title="kind">
                    {g.kind}
                  </div>
                </div>
              </div>

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
                          {s.title ?? s.id}
                          <span className="ml-2 text-xs text-gray-500">({s.id})</span>
                        </span>
                        {errorText ? (
                          <span className={`text-xs ${isErr ? 'text-red-400' : 'text-yellow-300'}`}>{errorText}</span>
                        ) : null}
                      </div>

                      <Input
                        type="number"
                        value={Number.isFinite(value) ? value : 0}
                        min={0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const v = raw === '' ? 0 : Number(raw);
                          setSkill(s.id, Number.isFinite(v) ? v : 0);
                        }}
                        className={isErr ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
                        style={
                          !isErr
                            ? { borderColor: border ?? undefined, boxShadow: 'none' }
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
