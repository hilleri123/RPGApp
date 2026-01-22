'use client';

import { useMemo } from 'react';
import { Skill, SkillGroup, NpcData, NpcConfig } from '../types';

type Props = {
  data: Record<string, any>;
  config?: NpcConfig;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function NPCDataView({ data, config }: Props) {
  const npc = (data ?? {}) as NpcData;

  const groups: SkillGroup[] = config?.skillGroups ?? [];
  const skills: Skill[] = config?.skills ?? [];

  const groupIndex = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const isGeneralGroupId = (gid: string) => groupIndex.get(gid)?.kind === 'general';

  const skillValues: Record<string, number> = (npc.skills ?? {}) as any;

  const generalSkills = useMemo(() => {
    return skills.filter((s) => isGeneralGroupId(s.group));
  }, [skills, groups]);

  const byGroup = useMemo(() => {
    return generalSkills.reduce<Record<string, Skill[]>>((acc, s) => {
      (acc[s.group] ??= []).push(s);
      return acc;
    }, {});
  }, [generalSkills]);

  const orderedGroupIds = useMemo(() => {
    const g = groups.filter((x) => x.kind === 'general').map((x) => x.id);
    return g.length ? g : Object.keys(byGroup);
  }, [groups, byGroup]);

  const totals = useMemo(() => {
    let total = 0;
    for (const s of generalSkills) total += Number(skillValues?.[s.id] ?? 0) || 0;
    return total;
  }, [generalSkills, skillValues]);

  return (
    <div className="space-y-3">
      <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-1">
        <div className="text-sm text-gray-300 mt-2">
          <span className="text-gray-400">General очки (сумма):</span> {totals}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
          {npc.hitThreshold != null ? <div className="text-gray-300">HT: <span className="text-gray-100">{npc.hitThreshold}</span></div> : null}
          {npc.armor != null ? <div className="text-gray-300">Armor: <span className="text-gray-100">{npc.armor}</span></div> : null}
          {npc.health != null ? <div className="text-gray-300">Health: <span className="text-gray-100">{npc.health}</span></div> : null}
          {npc.stability != null ? <div className="text-gray-300">Stability: <span className="text-gray-100">{npc.stability}</span></div> : null}
        </div>
      </div>

      {/* Группы general */}
      {orderedGroupIds.map((gid) => {
        const g =
          groupIndex.get(gid) ??
          ({ id: gid, title: gid, color: '#64748b', kind: 'general' } as SkillGroup);

        const items = byGroup[gid] ?? [];
        if (!items.length) return null;

        const groupMax = Math.max(
          1,
          ...items.map((s) => Number(skillValues?.[s.id] ?? 0) || 0)
        );

        return (
          <div key={gid} className="border border-gray-700 rounded-md overflow-hidden bg-black/20">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: g.color ?? '#64748b' }}
                  title={g.id}
                />
                <div className="text-sm text-white">{g.title}</div>
              </div>

              <div className="text-[11px] px-2 py-0.5 rounded border border-gray-700" style={{ color: g.color ?? '#94a3b8' }}>
                {gid}
              </div>
            </div>

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

                    <div className="col-span-4 md:col-span-5">
                      <div className="h-2 rounded bg-gray-800 overflow-hidden border border-gray-700">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: g.color ?? '#64748b', opacity: 0.85 }} />
                      </div>
                    </div>

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

      {/* fallback */}
      {!config ? (
        <pre className="text-xs bg-black/30 border border-gray-700 rounded-md p-2 overflow-x-auto">
          {JSON.stringify(data ?? {}, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
