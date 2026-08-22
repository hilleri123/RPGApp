'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Swords, Plus, Trash2 } from 'lucide-react';
import { CharacterConfig, CharacterData, ValidationIssue } from '../types';
import GumshoeSkillGroups from './shared/GumshoeSkillGroups';

type EditorMode = 'creation' | 'play';

type Props = {
  data: CharacterData;
  config: CharacterConfig;
  issues?: ValidationIssue[];
  onChange: (next: CharacterData) => void;
  allowModeSwitch?: boolean;
};

function normalizeIssuePath(p: string) {
  return p.startsWith('data.') ? p.slice(5) : p;
}

function InjuriesSection({
  data,
  onChange,
}: {
  data: CharacterData;
  onChange: (next: CharacterData) => void;
}) {
  const injuries = data.injuries ?? [];

  const update = (idx: number, patch: Partial<(typeof injuries)[number]>) => {
    const next = injuries.map((inj, i) => (i === idx ? { ...inj, ...patch } : inj));
    onChange({ ...data, injuries: next });
  };

  const add = () =>
    onChange({ ...data, injuries: [...injuries, { level: 0, tags: [], text: '' }] });

  const remove = (idx: number) =>
    onChange({ ...data, injuries: injuries.filter((_, i) => i !== idx) });

  const addTag = (idx: number, tag: string) => {
    const t = tag.trim();
    if (!t || injuries[idx].tags.includes(t)) return;
    update(idx, { tags: [...injuries[idx].tags, t] });
  };

  const removeTag = (idx: number, tag: string) =>
    update(idx, { tags: injuries[idx].tags.filter((t) => t !== tag) });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-100">Травмы / Состояния</span>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          <Plus className="w-3.5 h-3.5" />
          Добавить
        </button>
      </div>

      {injuries.length === 0 && (
        <p className="text-xs text-gray-500 italic">Травм нет</p>
      )}

      {injuries.map((inj, idx) => (
        <InjuryCard
          key={idx}
          injury={inj}
          onUpdate={(patch) => update(idx, patch)}
          onRemove={() => remove(idx)}
          onAddTag={(tag) => addTag(idx, tag)}
          onRemoveTag={(tag) => removeTag(idx, tag)}
        />
      ))}
    </div>
  );
}

type Injury = { level: number; tags: string[]; text: string };

function InjuryCard({
  injury,
  onUpdate,
  onRemove,
  onAddTag,
  onRemoveTag,
}: {
  injury: Injury;
  onUpdate: (patch: Partial<Injury>) => void;
  onRemove: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}) {
  const [tagInput, setTagInput] = useState('');

  const levelColor =
    injury.level === 0
      ? 'border-gray-700'
      : injury.level <= 2
      ? 'border-yellow-700'
      : injury.level <= 4
      ? 'border-orange-700'
      : 'border-red-700';

  return (
    <div className={`rounded border bg-black/20 p-3 space-y-2 ${levelColor}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            <label className="text-xs text-gray-400">Ур.</label>
            <Input
              type="number"
              min={0}
              value={injury.level}
              onChange={(e) => onUpdate({ level: Math.max(0, Number(e.target.value) || 0) })}
              className="w-14 text-sm"
            />
          </div>
          <Input
            value={injury.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Описание травмы…"
            className="text-sm flex-1"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
          aria-label="Удалить травму"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {injury.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-200 border border-gray-600"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemoveTag(tag)}
              className="text-gray-400 hover:text-red-400 leading-none"
              aria-label={`Удалить ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <div className="flex gap-1">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddTag(tagInput);
                setTagInput('');
              }
            }}
            placeholder="тег…"
            className="text-xs w-24 h-6 px-2"
          />
          <button
            type="button"
            onClick={() => {
              onAddTag(tagInput);
              setTagInput('');
            }}
            className="text-xs px-1.5 rounded border border-gray-600 text-gray-400 hover:bg-gray-700"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function ResistanceRow({
  data,
  onChange,
}: {
  data: CharacterData;
  onChange: (next: CharacterData) => void;
}) {
  return (
    <div className="rounded border border-gray-700 bg-black/20 p-3 flex items-center gap-4">
      <Swords className="w-4 h-4 text-orange-400 shrink-0" />
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-300 whitespace-nowrap">Сложность попадания</label>
        <Input
          type="number"
          min={0}
          value={data.hit_difficulty ?? 4}
          onChange={(e) =>
            onChange({ ...data, hit_difficulty: Math.max(0, Number(e.target.value) || 0) })
          }
          className="w-20 text-sm"
        />
      </div>
    </div>
  );
}

export default function CharacterDataEditor({
  data,
  config,
  issues,
  onChange,
  allowModeSwitch = true,
}: Props) {
  const [mode, setMode] = useState<EditorMode>('play');

  const skillGroups = config?.skillGroups ?? [];
  const skills = config?.skills ?? [];

  const groupKindById = useMemo(() => {
    const m = new Map<string, 'investigative' | 'general' | 'both'>();
    for (const g of skillGroups) m.set(g.id, g.kind);
    return m;
  }, [skillGroups]);

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);


  const setSkill = (skillId: string, value: number | null) => {
    const next = structuredClone(data) as CharacterData;
    console.info(mode, next, skillId, value);
    if (mode === 'creation') {
      next.initial_skills = next.initial_skills ?? {};
      if (value === null) delete next.initial_skills[skillId];
      else next.initial_skills[skillId] = value;
    } else {
      next.skills = next.skills ?? {};
      if (value === null) delete next.skills[skillId];
      else next.skills[skillId] = value;
    }
    onChange(next);
  };

  const setPoints = (patch: Partial<{ investigativeMax: number; generalMax: number }>) => {
    const next = structuredClone(data) as CharacterData;
    next.points = next.points ?? { investigativeMax: 0, generalMax: 0 };
    if (patch.investigativeMax != null)
      next.points.investigativeMax = Math.max(0, Number(patch.investigativeMax) || 0);
    if (patch.generalMax != null)
      next.points.generalMax = Math.max(0, Number(patch.generalMax) || 0);
    onChange(next);
  };

  const totals = useMemo(() => {
    let investigativeTotal = 0;
    let generalTotal = 0;
    for (const s of skills) {
      if (!(s.id in (data.initial_skills ?? {}))) continue;
      const v = Number(data.initial_skills?.[s.id]) || 0;
      const kind = groupKindById.get(s.group);
      if (kind === 'investigative') investigativeTotal += v;
      else if (kind === 'general' || kind === 'both') generalTotal += v;
    }
    return { investigativeTotal, generalTotal };
  }, [skills, data?.initial_skills, groupKindById]);

  const points = data?.points ?? config.initialData?.points ?? { investigativeMax: 0, generalMax: 0 };
  const investigativeMax = Number(points.investigativeMax ?? 0);
  const generalMax = Number(points.generalMax ?? 0);
  const invOver = totals.investigativeTotal > investigativeMax;
  const genOver = totals.generalTotal > generalMax;

  const effectiveInitialSkills = useMemo(() => {
    const initial = data?.initial_skills ?? {};
    const bonus = data?.bonus_skills ?? {};
    const result: Record<string, number> = {};

    const keys = new Set([...Object.keys(initial), ...Object.keys(bonus)]);

    for (const key of keys) {
      result[key] = Number(initial[key] ?? 0) + Number(bonus[key] ?? 0);
    }

    return result;
  }, [data?.initial_skills, data?.bonus_skills]);

  const handleResetCurrent = () => {
    const next = structuredClone(data) as CharacterData;
    next.skills = { ...(effectiveInitialSkills ?? {}) };
    onChange(next);
  };


  const exceededSkills = useMemo(() => {
    const result = new Set<string>();

    for (const [skillId, currentValue] of Object.entries(data?.skills ?? {})) {
      const initialValue = Number(effectiveInitialSkills[skillId] ?? 0);
      const current = Number(currentValue ?? 0);

      if (current > initialValue) {
        result.add(skillId);
      }
    }

    return result;
  }, [data?.skills, effectiveInitialSkills]);


  return (
    <div className="space-y-5">
      <ResistanceRow data={data} onChange={onChange} />

      <div className="rounded border border-gray-700 bg-black/20 p-3">
        <InjuriesSection data={data} onChange={onChange} />
      </div>

      <div className="space-y-5">
        {allowModeSwitch && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-gray-700 bg-gray-800/50">
              {(['play', 'creation'] as EditorMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-4 py-1.5 text-sm rounded-md transition-all ${
                    mode === m
                      ? 'bg-gray-700 text-white font-medium shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {m === 'creation' ? '🛠 Создание' : '⚔️ Игра'}
                </button>
              ))}
            </div>

            {mode === 'play' && (
              <button
                type="button"
                onClick={handleResetCurrent}
                title="Скопировать начальные навыки в текущие"
                className="text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
              >
                ↺ Сбросить к начальным
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-gray-500 -mt-2">
          {mode === 'creation'
            ? 'Задайте начальные навыки и бюджет очков. Если начальные навыки не заданы, будут показаны текущие.'
            : 'Изменяйте текущие навыки во время сессии. Рядом — начальное значение.'}
        </p>



        {mode === 'creation' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              className={`rounded border p-3 space-y-2 ${
                invOver ? 'border-red-700 bg-red-950/20' : 'border-gray-700 bg-black/20'
              }`}
            >
              <div className={`text-sm font-semibold ${invOver ? 'text-red-400' : 'text-gray-300'}`}>
                Investigative: {totals.investigativeTotal} / {investigativeMax}
              </div>
              <div className="text-xs text-gray-500">Следственные навыки</div>
              <Input
                type="number"
                min={0}
                value={investigativeMax}
                onChange={(e) => setPoints({ investigativeMax: Number(e.target.value || 0) })}
                className={`w-24 ${invOver ? 'border-red-500' : ''}`}
              />
              {invOver && <div className="text-red-400 text-xs">Превышен лимит investigative.</div>}
            </div>

            <div
              className={`rounded border p-3 space-y-2 ${
                genOver ? 'border-red-700 bg-red-950/20' : 'border-gray-700 bg-black/20'
              }`}
            >
              <div className={`text-sm font-semibold ${genOver ? 'text-red-400' : 'text-gray-300'}`}>
                General: {totals.generalTotal} / {generalMax}
              </div>
              <div className="text-xs text-gray-500">Общие навыки</div>
              <Input
                type="number"
                min={0}
                value={generalMax}
                onChange={(e) => setPoints({ generalMax: Number(e.target.value || 0) })}
                className={`w-24 ${genOver ? 'border-red-500' : ''}`}
              />
              {genOver && <div className="text-red-400 text-xs">Превышен лимит general.</div>}
            </div>
          </div>
        )}

        <GumshoeSkillGroups
          mode="number"
          groups={skillGroups}
          skills={skills}
          values={mode === 'creation' ? (data?.initial_skills ?? {}) : (data?.skills ?? {})}
          initialValues={mode === 'play' ? effectiveInitialSkills : undefined}
          exceededSkillIds={mode === 'play' ? exceededSkills : undefined}
          issueMap={issueMap}
          onChange={setSkill}
        />
      </div>

    </div>
  );
}