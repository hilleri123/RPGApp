'use client';

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';

type Issue = { path: string; message: string; level?: 'error' | 'warning' };

type SkillGroup = { id: string; title: string };
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
  // поддержка "data.skills.athletics" и "skills.athletics"
  return p.startsWith('data.') ? p.slice(5) : p;
}

export default function CharacterDataEditor({ data, config, issues, onChange }: Props) {
  // 1) Инициализация data из initialData (1 раз на открытие/смену config)
  useEffect(() => {
    const hasSkills = data && typeof data === 'object' && data.skills && typeof data.skills === 'object';
    if (!hasSkills && config?.initialData) {
      // не делаем merge глубоко — берём initialData как базу
      onChange(structuredClone(config.initialData));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]); // важно: не зависеть от data, иначе будет цикл

  const skillGroups = config?.skillGroups ?? [];
  const skills = config?.skills ?? [];
  const maxSkillPoints = config?.constraints?.maxSkillPoints;

  const skillTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of skills) m.set(s.id, s.title);
    return m;
  }, [skills]);

  const skillsByGroup = useMemo(() => {
    // group -> skills[]
    return skills.reduce<Record<string, Skill[]>>((acc, s) => {
      (acc[s.group] = acc[s.group] || []).push(s);
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
      {/* Хедер поинтов */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-300">Навыки</div>
        <div className={`text-sm ${overLimit ? 'text-red-400' : 'text-gray-300'}`}>
          Очки: {totalPoints}
          {typeof maxSkillPoints === 'number' ? ` / ${maxSkillPoints}` : ''}
        </div>
      </div>

      {overLimit ? (
        <div className="text-red-400 text-xs">
          Превышен лимит очков навыков.
        </div>
      ) : null}

      {/* Группы */}
      <div className="space-y-4">
        {skillGroups.map((g) => {
          const groupSkills = skillsByGroup[g.id] ?? [];
          if (groupSkills.length === 0) return null;

          return (
            <div key={g.id} className="border border-gray-700 rounded-md p-3 space-y-3">
              <div className="text-sm text-gray-200 font-semibold">{g.title}</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupSkills.map((s) => {
                  const value = Number(currentSkills?.[s.id] ?? 0);
                  const issue =
                    issueMap.get(`skills.${s.id}`) ||
                    issueMap.get(`skills.${s.id}.value`)
                    ;

                  const errorText = issue?.message;

                  return (
                    <div key={s.id} className="space-y-1">
                      <div className="text-sm text-gray-300 flex justify-between">
                        <span>{skillTitleById.get(s.id) ?? s.id}</span>
                        {errorText ? (
                          <span className="text-red-400 text-xs ml-2">{errorText}</span>
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
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* items пока можно показывать как JSON / отдельным компонентом */}
      {/* <pre className="text-xs">{JSON.stringify(data?.items ?? [], null, 2)}</pre> */}
    </div>
  );
}
