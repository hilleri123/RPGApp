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

// ── Двухсегментная полоска ────────────────────────────────────────────────────
function SkillBar({
  value,
  base,
  color,
}: {
  value: number;
  base: number;
  color: string;
}) {

  if (base === 0 && value === 0) {
    return (
      <div className="h-2.5 rounded bg-gray-800 border border-gray-700" />
    );
  }

  // если value > base — полоска уходит за 100%
  const total = Math.max(base, value);

  const pctBase    = clamp((base    / total) * 100, 0, 100); // отметка
  const pctCurrent = clamp((value   / total) * 100, 0, 100);

  const gained = value > base;
  const spent  = value < base;

  return (
    <div className="relative h-2.5 rounded bg-gray-800 overflow-hidden border border-gray-700">
      {/* initial — тёмный сегмент */}
      <div
        className="absolute inset-y-0 left-0"
        style={{ width: `${pctBase}%`, backgroundColor: color, opacity: 0.35 }}
      />


      {/* current > base → яркий выход за base */}
      {gained && (
        <div
          className="absolute inset-y-0"
          style={{
            left:  `${pctBase}%`,
            width: `${pctCurrent - pctBase}%`,
            backgroundColor: color,
            opacity: 0.95,
          }}
        />
      )}

      {/* current < base → красная «потраченная» часть */}
      {spent && (
        <div
          className="absolute inset-y-0"
          style={{
            left:  `${pctCurrent}%`,
            width: `${pctBase - pctCurrent}%`,
            backgroundColor: '#ef4444',
            opacity: 0.55,
          }}
        />
      )}

      {/* отметка base — тонкая черта */}
      {base > 0 && !gained && (
        <div
          className="absolute inset-y-0 w-px bg-white/30"
          style={{ left: `${pctBase}%` }}
        />
      )}
    </div>
  );
}


// ── Компонент ─────────────────────────────────────────────────────────────────
export default function CharacterDataView({ data, config }: Props) {
  const groups: SkillGroup[] = config?.skillGroups ?? [];
  const skills: Skill[]      = config?.skills      ?? [];

  const skillValues:   Record<string, number> = (data?.skills         ?? {}) as any;
  const initialValues: Record<string, number> = (data?.initial_skills ?? {}) as any;
  const bonusValues:   Record<string, number> = (data?.bonus_skills   ?? {}) as any;

  const points         = data?.points ?? {};
  const hasPoints = data?.points != null;
  const investigativeMax = hasPoints ? Number(points?.investigativeMax ?? 0) : null;
  const generalMax       = hasPoints ? Number(points?.generalMax       ?? 0) : null;


  const groupIndex = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const byGroup = useMemo(() => {
    return skills.reduce<Record<string, Skill[]>>((acc, s) => {
      (acc[s.group] ??= []).push(s);
      return acc;
    }, {});
  }, [skills]);

  const orderedGroupIds = useMemo(
    () => (groups.length ? groups.map((g) => g.id) : Object.keys(byGroup)),
    [groups, byGroup],
  );

  const totals = useMemo(() => {
    let investigativeTotal = 0;
    let generalTotal = 0;
    for (const s of skills) {
      const raw = Number(initialValues?.[s.id] ?? 0); // было skillValues
      const v   = Number.isFinite(raw) ? raw : 0;
      const g   = groupIndex.get(s.group);
      if (!g) continue;
      if (g.kind === 'investigative')                    investigativeTotal += v;
      else if (g.kind === 'general' || g.kind === 'both') generalTotal += v;
    }
    return { investigativeTotal, generalTotal };
  }, [skills, skillValues, groupIndex]);

  const invOver = hasPoints && investigativeMax != null && totals.investigativeTotal > investigativeMax;
  const genOver = hasPoints && generalMax       != null && totals.generalTotal       > generalMax;

  // max среди current + base, чтобы масштаб был честным
  const getGroupMaxValue = (gid: string) => {
    const items = byGroup[gid] ?? [];
    let mx = 0;
    for (const s of items) {
      const cur     = Number.isFinite(Number(skillValues[s.id]))   ? Number(skillValues[s.id])   : 0;
      const initial = Number.isFinite(Number(initialValues[s.id])) ? Number(initialValues[s.id]) : 0;
      const bonus   = Number.isFinite(Number(bonusValues[s.id]))   ? Number(bonusValues[s.id])   : 0;
      mx = Math.max(mx, cur, initial + bonus);
    }
    return Math.max(1, mx);
  };

  return (
    <div className="space-y-3">
      {/* Totals */}
      {config && hasPoints ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded border border-gray-700 bg-black/20 p-3">
            <div className={`text-sm ${invOver ? 'text-yellow-400' : 'text-gray-200'}`}>
              Investigative: {totals.investigativeTotal} / {investigativeMax}
            </div>
            {invOver && <div className="text-xs text-yellow-400 mt-1">Превышен лимит investigative.</div>}
          </div>
          <div className="rounded border border-gray-700 bg-black/20 p-3">
            <div className={`text-sm ${genOver ? 'text-yellow-400' : 'text-gray-200'}`}>
              General: {totals.generalTotal} / {generalMax}
            </div>
            {genOver && <div className="text-xs text-yellow-400 mt-1">Превышен лимит general.</div>}
          </div>
        </div>
      ) : null}

      {/* Группы */}
      {orderedGroupIds.map((gid) => {
        const g     = groupIndex.get(gid) ?? ({ id: gid, title: gid, color: '#64748b', kind: 'general' } as SkillGroup);
        const items = byGroup[gid] ?? [];
        if (!items.length) return null;

        const groupMax = getGroupMaxValue(gid);

        return (
          <div key={gid} className="border border-gray-700 rounded-md overflow-hidden bg-black/20">
            {/* Заголовок */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: g.color ?? '#64748b' }}
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

            {/* Скиллы */}
            <div className="divide-y divide-gray-800">
              {items.map((s) => {
                const value   = Number.isFinite(Number(skillValues[s.id]))   ? Number(skillValues[s.id])   : 0;
                const initial = Number.isFinite(Number(initialValues[s.id])) ? Number(initialValues[s.id]) : 0;
                const bonus   = Number.isFinite(Number(bonusValues[s.id]))   ? Number(bonusValues[s.id])   : 0;
                const base    = initial + bonus;

                return (
                  <div key={s.id} className="px-3 py-2 grid grid-cols-12 gap-2 items-center">
                    {/* Название */}
                    <div className="col-span-5 text-sm text-gray-100 leading-tight">
                      {s.title}
                      <span className="ml-1.5 text-xs text-gray-500">({s.id})</span>
                    </div>

                    {/* Полоска */}
                    <div className="col-span-5">
                      <SkillBar
                        value={value}
                        base={base}
                        color={g.color ?? '#64748b'}
                      />
                    </div>

                    {/* current / base */}
                    <div className="col-span-2 flex flex-col items-end leading-none">
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: g.color ?? '#e2e8f0' }}
                      >
                        {value}
                      </span>
                      {base > 0 && (
                        <span className="text-[10px] text-gray-500 tabular-nums">
                          / {base}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Fallback */}
      {(!skills.length || !groups.length) && (
        <pre className="text-xs bg-black/30 border border-gray-700 rounded-md p-2 overflow-x-auto">
          {JSON.stringify(data ?? {}, null, 2)}
        </pre>
      )}
    </div>
  );
}