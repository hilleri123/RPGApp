'use client';

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  ValidationIssue,
  Skill,
  SkillGroup,
  SkillsConfig,
  ObstacleData,
  ObstacleClue,
  ObstacleChallenge,
} from '../types';

type Props = {
  data: Record<string, any>;
  config?: (SkillsConfig & { initialData?: any });
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

export default function ObstacleDataEditor({ data, config, issues, onChange }: Props) {
  useEffect(() => {
    const hasObject = data && typeof data === 'object';
    const hasType = hasObject && typeof (data as any).type === 'string';
    if (!hasType) {
      if (config?.initialData) onChange(structuredClone(config.initialData));
      else onChange({ type: 'clue', name: '', description: '', investigative_skills: [], spend_cost: 0, reward: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const groups: SkillGroup[] = config?.skillGroups ?? [];
  const skills: Skill[] = config?.skills ?? [];

  const groupKindById = useMemo(() => {
    const m = new Map<string, 'investigative' | 'general'>();
    for (const g of groups) m.set(g.id, g.kind);
    return m;
  }, [groups]);

  const skillKindById = useMemo(() => {
    const m = new Map<string, 'investigative' | 'general' | 'unknown'>();
    for (const s of skills) m.set(s.id, groupKindById.get(s.group) ?? 'unknown');
    return m;
  }, [skills, groupKindById]);

  const investigativeSkills = useMemo(() => skills.filter((s) => skillKindById.get(s.id) === 'investigative'), [skills, skillKindById]);
  const generalSkills = useMemo(() => skills.filter((s) => skillKindById.get(s.id) === 'general'), [skills, skillKindById]);

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const value = (data ?? {}) as ObstacleData;

  const set = (patch: Partial<any>) => {
    onChange({ ...(structuredClone(value) as any), ...(patch as any) });
  };

  const setType = (t: 'clue' | 'challenge') => {
    if (t === value.type) return;

    const base = { name: (value as any).name ?? '', description: (value as any).description ?? '' };

    if (t === 'clue') {
      const next: ObstacleClue = { type: 'clue', ...base, investigative_skills: [], spend_cost: 0, reward: '' };
      onChange(next as any);
    } else {
      const next: ObstacleChallenge = { type: 'challenge', ...base, general_skill: '', difficulty: 4, on_success: '', on_fail: '' };
      onChange(next as any);
    }
  };

  const toggleInvestigativeSkill = (sid: string) => {
    if (value.type !== 'clue') return;
    const set0 = new Set(value.investigative_skills ?? []);
    if (set0.has(sid)) set0.delete(sid);
    else set0.add(sid);
    set({ investigative_skills: Array.from(set0) });
  };

  const err = (path: string) => issueMap.get(path)?.message;
  const hasErr = (path: string) => !!err(path) && (issueMap.get(path)?.level ?? 'error') === 'error';

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Название</div>
            <Input
              value={(value as any).name ?? ''}
              onChange={(e) => set({ name: e.target.value })}
              className={hasErr('name') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
            />
            {err('name') ? <div className="text-xs text-red-400">{err('name')}</div> : null}
          </label>

          <label className="space-y-1">
            <div className="text-sm text-gray-300">Тип</div>
            <select
              className="w-full rounded-md border border-gray-700 bg-black/20 px-3 py-2 text-gray-100"
              value={value.type ?? 'clue'}
              onChange={(e) => setType(e.target.value as any)}
            >
              <option value="clue">Улика (spend)</option>
              <option value="challenge">Препятствие (проверка)</option>
            </select>
          </label>
        </div>

        <label className="space-y-1">
          <div className="text-sm text-gray-300">Описание</div>
          <textarea
            className="w-full min-h-[88px] rounded-md border border-gray-700 bg-black/20 px-3 py-2 text-gray-100 outline-none"
            value={(value as any).description ?? ''}
            onChange={(e) => set({ description: e.target.value })}
          />
        </label>
      </div>

      {value.type === 'clue' ? (
        <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-4">
          <label className="space-y-1">
            <div className="text-sm text-gray-300">Цена (spend_cost)</div>
            <Input
              type="number"
              min={0}
              value={value.spend_cost ?? 0}
              onChange={(e) => set({ spend_cost: Math.max(0, asNumber(e.target.value, 0)) })}
              className={hasErr('spend_cost') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
            />
            {err('spend_cost') ? <div className="text-xs text-red-400">{err('spend_cost')}</div> : null}
          </label>

          <div className="space-y-2">
            <div className="text-sm text-gray-300">Investigative skills (можно несколько)</div>
            {err('investigative_skills') ? <div className="text-xs text-red-400">{err('investigative_skills')}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {investigativeSkills.map((s) => {
                const checked = (value.investigative_skills ?? []).includes(s.id);
                return (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-gray-200">
                    <input type="checkbox" checked={checked} onChange={() => toggleInvestigativeSkill(s.id)} />
                    <span>
                      {s.title} <span className="text-xs text-gray-500">({s.id})</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <label className="space-y-1">
            <div className="text-sm text-gray-300">Награда/эффект (reward)</div>
            <Input value={value.reward ?? ''} onChange={(e) => set({ reward: e.target.value })} />
          </label>
        </div>
      ) : (
        <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-4">
          <label className="space-y-1">
            <div className="text-sm text-gray-300">General skill</div>
            <select
              className={`w-full rounded-md border bg-black/20 px-3 py-2 text-gray-100 ${
                hasErr('general_skill') ? 'border-red-500' : 'border-gray-700'
              }`}
              value={value.general_skill ?? ''}
              onChange={(e) => set({ general_skill: e.target.value })}
            >
              <option value="">—</option>
              {generalSkills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.id})
                </option>
              ))}
            </select>
            {err('general_skill') ? <div className="text-xs text-red-400">{err('general_skill')}</div> : null}
          </label>

          <label className="space-y-1">
            <div className="text-sm text-gray-300">Сложность (difficulty)</div>
            <Input
              type="number"
              min={2}
              value={value.difficulty ?? 4}
              onChange={(e) => set({ difficulty: Math.max(2, asNumber(e.target.value, 4)) })}
              className={hasErr('difficulty') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
            />
            {err('difficulty') ? <div className="text-xs text-red-400">{err('difficulty')}</div> : null}
          </label>

          <label className="space-y-1">
            <div className="text-sm text-gray-300">Успех (on_success)</div>
            <Input value={value.on_success ?? ''} onChange={(e) => set({ on_success: e.target.value })} />
          </label>

          <label className="space-y-1">
            <div className="text-sm text-gray-300">Провал (on_fail)</div>
            <Input value={value.on_fail ?? ''} onChange={(e) => set({ on_fail: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}
