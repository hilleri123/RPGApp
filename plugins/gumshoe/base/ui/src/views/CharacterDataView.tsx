'use client';

import { useMemo } from 'react';
import { Skill, SkillGroup, CharacterConfig } from '../types';

type Props = {
  data: Record<string, any>;
  config?: CharacterConfig;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function CharacterDataView({ data, config }: Props) {
  const groups: SkillGroup[] = config?.skillGroups ?? [];
  const skills: Skill[] = config?.skills ?? [];

  const skillValues: Record<string, number> = (data?.skills ?? {}) as any;

  const points = data?.points ?? {};
  const investigativeMax = Number(
    points?.investigativeMax ?? config?.constraints?.defaultInvestigativePoints ?? 0
  );
  const generalMax = Number(points?.generalMax ?? config?.constraints?.defaultGeneralPoints ?? 0);

  // groupId -> group
  const groupIndex = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  // skills grouped by group id
  const byGroup = useMemo(() => {
    return skills.reduce<Record<string, Skill[]>>((acc, s) => {
      (acc[s.group] ??= []).push(s);
      return acc;
    }, {});
  }, [skills]);

  const orderedGroupIds = useMemo(() => {
    return groups.length ? groups.map((g) => g.id) : Object.keys(byGroup);
  }, [groups, byGroup]);

  // totals по kind (через SkillGroup.kind)
  const totals = useMemo(() => {
    let investigativeTotal = 0;
    let generalTotal = 0;

    for (const s of skills) {
      const raw = Number(skillValues?.[s.id] ?? 0);
      const v = Number.isFinite(raw) ? raw : 0;
      const g = groupIndex.get(s.group);
      if (!g) continue;
      if (g.kind === 'investigative') investigativeTotal += v;
      else if (g.kind === 'general') generalTotal += v;
    }

    return { investigativeTotal, generalTotal };
  }, [skills, skillValues, groupIndex]);

  const invOver = Number.isFinite(investigativeMax) ? totals.investigativeTotal > investigativeMax : false;
  const genOver = Number.isFinite(generalMax) ? totals.generalTotal > generalMax : false;

  const getGroupMaxValue = (gid: string) => {
    const items = byGroup[gid] ?? [];
    let mx = 0;
    for (const s of items) {
      const raw = Number(skillValues?.[s.id] ?? 0);
      const v = Number.isFinite(raw) ? raw : 0;
      mx = Math.max(mx, v);
    }
    return Math.max(1, mx); // чтобы не делить на 0
  };

  return (
    <div className="space-y-3">
      {/* Шапка: totals */}
      {config ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded border border-gray-700 bg-black/20 p-3">
            <div className={`text-sm ${invOver ? 'text-red-400' : 'text-gray-200'}`}>
              Investigative: {totals.investigativeTotal} / {Number.isFinite(investigativeMax) ? investigativeMax : 0}
            </div>
            {invOver ? <div className="text-xs text-red-400 mt-1">Превышен лимит investigative.</div> : null}
          </div>

          <div className="rounded border border-gray-700 bg-black/20 p-3">
            <div className={`text-sm ${genOver ? 'text-red-400' : 'text-gray-200'}`}>
              General: {totals.generalTotal} / {Number.isFinite(generalMax) ? generalMax : 0}
            </div>
            {genOver ? <div className="text-xs text-red-400 mt-1">Превышен лимит general.</div> : null}
          </div>
        </div>
      ) : null}

      {/* Группы */}
      {orderedGroupIds.map((gid) => {
        const g = groupIndex.get(gid) ?? ({ id: gid, title: gid, color: '#64748b', kind: 'general' } as SkillGroup);
        const items = byGroup[gid] ?? [];
        if (!items.length) return null;

        const groupMax = getGroupMaxValue(gid);

        return (
          <div key={gid} className="border border-gray-700 rounded-md overflow-hidden bg-black/20">
            {/* Заголовок группы */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: g.color ?? '#64748b' }}
                  title={g.id}
                />
                <div className="text-sm text-white">{g.title}</div>
                <div className="text-[11px] text-gray-400">{g.kind}</div>
              </div>

              <div
                className="text-[11px] px-2 py-0.5 rounded border border-gray-700"
                style={{ color: g.color ?? '#94a3b8' }}
              >
                {gid}
              </div>
            </div>

            {/* Скиллы группы */}
            <div className="divide-y divide-gray-800">
              {items.map((s) => {
                const raw = Number(skillValues?.[s.id] ?? 0);
                const value = Number.isFinite(raw) ? raw : 0;

                const pct = clamp((value / groupMax) * 100, 0, 100);

                return (
                  <div key={s.id} className="px-3 py-2 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6 md:col-span-5 text-sm text-gray-100">
                      {s.title}
                      <span className="ml-2 text-xs text-gray-500">({s.id})</span>
                    </div>

                    {/* Полоска */}
                    <div className="col-span-4 md:col-span-5">
                      <div className="h-2 rounded bg-gray-800 overflow-hidden border border-gray-700">
                        <div
                          className="h-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: g.color ?? '#64748b',
                            opacity: 0.85,
                          }}
                        />
                      </div>
                    </div>

                    {/* Значение */}
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-medium" style={{ color: g.color ?? '#e2e8f0' }}>
                        {value}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* fallback если нет config */}
      {(!skills.length || !groups.length) && (
        <pre className="text-xs bg-black/30 border border-gray-700 rounded-md p-2 overflow-x-auto">
          {JSON.stringify(data ?? {}, null, 2)}
        </pre>
      )}
    </div>
  );
}
