'use client';

import { useMemo } from 'react';
import { ObstacleData, Skill, SkillGroup, SkillsConfig } from '../types';

type Props = {
  data: Record<string, any>;
  config?: SkillsConfig;
};

export default function ObstacleDataView({ data, config }: Props) {
  const ob = (data ?? {}) as ObstacleData;

  const groups: SkillGroup[] = config?.skillGroups ?? [];
  const skills: Skill[] = config?.skills ?? [];

  const skillTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of skills) m.set(s.id, s.title);
    return m;
  }, [skills]);

  const groupKindById = useMemo(() => {
    const m = new Map<string, 'investigative' | 'general' | 'both'>();
    for (const g of groups) m.set(g.id, g.kind);
    return m;
  }, [groups]);

  const skillKindById = useMemo(() => {
    const m = new Map<string, 'investigative' | 'general' | 'both' | 'unknown'>();
    for (const s of skills) {
      const kind = groupKindById.get(s.group);
      m.set(s.id, kind ?? 'unknown');
    }
    return m;
  }, [skills, groupKindById]);

  return (
    <div className="space-y-3">
      <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-1">
        <div className="text-lg text-white">{(ob as any).name || 'Без названия'}</div>
        {(ob as any).description ? (
          <div className="text-sm text-gray-400 whitespace-pre-wrap">{(ob as any).description}</div>
        ) : null}
      </div>

      <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-2">
        

        <div className="text-sm text-gray-300">Скиллы:</div>
        <div className="flex flex-wrap gap-2">
          {(ob.investigative_skills ?? []).length ? (
            ob.investigative_skills.map((sid) => {
              const title = skillTitleById.get(sid) ?? sid;
              const kind = skillKindById.get(sid) ?? 'unknown';
              return (
                <span
                  key={sid}
                  className={`text-xs px-2 py-0.5 rounded border ${
                    kind === 'investigative' || kind === 'both' ? 'border-gray-700 text-gray-200' : 'border-red-700 text-red-300'
                  } bg-black/20`}
                  title={sid}
                >
                  {title}
                </span>
              );
            })
          ) : (
            <span className="text-xs text-gray-500">—</span>
          )}
        </div>

      </div>

      {!config ? (
        <pre className="text-xs bg-black/30 border border-gray-700 rounded-md p-2 overflow-x-auto">
          {JSON.stringify(data ?? {}, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
