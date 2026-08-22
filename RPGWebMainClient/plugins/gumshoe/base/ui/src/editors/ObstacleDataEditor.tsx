'use client';

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  ValidationIssue,
  Skill,
  SkillGroup,
  ObstacleConfig,
  ObstacleData,
  ClueSpend,
} from '../types';
import GumshoeSkillGroups from './shared/GumshoeSkillGroups';

type Props = {
  data: ObstacleData | Record<string, any>;
  config?: ObstacleConfig;
  issues?: ValidationIssue[];
  onChange: (next: ObstacleData) => void;
};

function normalizeIssuePath(p: string) {
  return p.startsWith('data.') ? p.slice(5) : p;
}

export default function ObstacleDataEditor({ data, config, issues, onChange }: Props) {
  // --- инициализация ---
  useEffect(() => {
    const hasObject = data && typeof data === 'object';

    if (!hasObject && config?.initialData) {
      onChange(structuredClone(config.initialData));
      return;
    }

    const next = structuredClone(hasObject ? data : {}) as Partial<ObstacleData>;
    let dirty = false;

    if (!Array.isArray(next.investigative_skills)) {
      next.investigative_skills = structuredClone(config?.initialData?.investigative_skills ?? []);
      dirty = true;
    }

    if (typeof next.base_text !== 'string') {
      next.base_text = config?.initialData?.base_text ?? '';
      dirty = true;
    }

    if (!Array.isArray(next.spends)) {
      next.spends = structuredClone(config?.initialData?.spends ?? []);
      dirty = true;
    }

    if (dirty) onChange(next as ObstacleData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const groups: SkillGroup[] = config?.skillGroups ?? [];
  const skills: Skill[] = config?.skills ?? [];

  // только investigative‑группы и скиллы
  const investigativeGroups = useMemo(
    () => (config?.skillGroups ?? []).filter((g) => g.kind === 'investigative' || g.kind === 'both'),
    [config?.skillGroups],
  );

  const investigativeSkills = useMemo(() => {
    const groupIds = new Set(investigativeGroups.map((g) => g.id));
    return (config?.skills ?? []).filter((s) => groupIds.has(s.group));
  }, [config?.skills, investigativeGroups]);


  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const value = (data ?? {}) as ObstacleData;

  const set = (patch: Partial<ObstacleData>) => {
    onChange({ ...(structuredClone(value) as ObstacleData), ...patch });
  };

  const toggleInvestigativeSkill = (sid: string) => {
    const set0 = new Set(value.investigative_skills ?? []);
    if (set0.has(sid)) set0.delete(sid);
    else set0.add(sid);
    set({ investigative_skills: Array.from(set0) });
  };

  const setSpend = (i: number, patch: Partial<ClueSpend>) => {
    const spends = [...(value.spends ?? [])];
    spends[i] = { ...spends[i], ...patch };
    set({ spends });
  };

  const addSpend = () => {
    const spends = [...(value.spends ?? [])];
    spends.push({ name: '', cost: 1, info: '' });
    set({ spends });
  };

  const removeSpend = (i: number) => {
    const spends = (value.spends ?? []).filter((_, j) => j !== i);
    set({ spends });
  };

  const err = (path: string) => issueMap.get(path)?.message;
  const hasErr = (path: string) => !!err(path) && (issueMap.get(path)?.level ?? 'error') === 'error';


  return (
    <div className="space-y-4">
      {/* Базовый текст препятствия */}
      <label className="space-y-1">
        <div className="text-sm text-gray-300">Описание препятствия (base_text)</div>
        <textarea
          className="w-full rounded-md border border-gray-700 bg-black/20 px-3 py-2 text-sm text-gray-100 min-h-[80px]"
          value={value.base_text ?? ''}
          onChange={(e) => set({ base_text: e.target.value })}
        />
        {err('base_text') ? (
          <div className="text-xs text-red-400">{err('base_text')}</div>
        ) : null}
      </label>

      {/* Навыки, с которых можно делать spend */}
      <div className="space-y-2">
        <div className="text-sm text-gray-300">
          Investigative‑навыки, с которых можно тратить очки на это препятствие
        </div>
        {err('investigative_skills') ? (
          <div className="text-xs text-red-400">{err('investigative_skills')}</div>
        ) : null}

        <GumshoeSkillGroups
          mode="checkbox"
          groups={investigativeGroups}
          skills={investigativeSkills}
          selected={value.investigative_skills ?? []}
          onToggle={toggleInvestigativeSkill}
          issueMap={issueMap}
        />
      </div>

      {/* Spends */}
      <div className="space-y-2">
        <div className="text-sm text-gray-300">Варианты трат (spends)</div>
        {(value.spends ?? []).map((sp, i) => (
          <div
            key={i}
            className="rounded border border-gray-700 bg-black/20 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 space-y-1">
                <div className="text-xs text-gray-400">Название</div>
                <Input
                  type="text"
                  value={sp.name}
                  onChange={(e) => setSpend(i, { name: e.target.value })}
                  className="w-full"
                />
              </div>
              <div className="w-24 space-y-1">
                <div className="text-xs text-gray-400">Стоимость</div>
                <Input
                  type="number"
                  min={0}
                  value={sp.cost}
                  onChange={(e) =>
                    setSpend(i, { cost: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => removeSpend(i)}
                className="self-start text-xs text-red-400 hover:text-red-300 px-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-gray-400">Что даёт эта трата (info)</div>
              <textarea
                className="w-full rounded-md border border-gray-700 bg-black/20 px-3 py-2 text-sm text-gray-100 min-h-[60px]"
                value={sp.info}
                onChange={(e) => setSpend(i, { info: e.target.value })}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addSpend}
          className="text-xs px-2 py-1 rounded border border-gray-700 bg-black/40 text-gray-200 hover:border-gray-500"
        >
          + добавить трату
        </button>
      </div>
    </div>
  );
}
