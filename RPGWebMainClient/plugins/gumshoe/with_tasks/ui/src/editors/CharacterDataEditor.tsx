'use client';

import { useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { CharacterConfig, CharacterData, ValidationIssue } from '../types';
import { CharacterDataEditor as BaseCharacterDataEditor } from '../../../../base/ui';
import { CharacterData as BaseCharacterData } from '../../../../base/ui/src/types';
import { Plus, Trash2 } from 'lucide-react';

type Props = {
  data: CharacterData;
  config: CharacterConfig;
  issues?: ValidationIssue[];
  onChange: (next: CharacterData) => void;
};

export default function CharacterDataEditor({ data, config, issues, onChange }: Props) {
  // инициализация общих полей
  useEffect(() => {
    const hasObject = data && typeof data === 'object';

    if (!hasObject && config?.initialData) {
      onChange({
        ...structuredClone(config.initialData),
        role: '',
        bonuses: [],
        tasks: [],
      });
      return;
    }

    const next = structuredClone(hasObject ? data : {}) as CharacterData;
    let dirty = false;

    if (!next.skills || typeof next.skills !== 'object') {
      next.skills = structuredClone(config.initialData?.skills ?? {});
      dirty = true;
    }

    const defaultInv = Number(config?.constraints?.defaultInvestigativePoints ?? 0);
    const defaultGen = Number(config?.constraints?.defaultGeneralPoints ?? 0);

    if (!next.points || typeof next.points !== 'object') {
      next.points = structuredClone(
        config.initialData?.points ?? { investigativeMax: defaultInv, generalMax: defaultGen },
      );
      dirty = true;
    } else {
      if (next.points.investigativeMax == null) { next.points.investigativeMax = defaultInv; dirty = true; }
      if (next.points.generalMax == null)        { next.points.generalMax = defaultGen;       dirty = true; }
    }

    if (next.role == null)          { next.role = '';   dirty = true; }
    if (!Array.isArray(next.bonuses)) { next.bonuses = []; dirty = true; }
    if (!Array.isArray(next.tasks))   { next.tasks   = []; dirty = true; }

    if (dirty) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // ---- role ----
  const setRole = (role: string) => onChange({ ...data, role });

  // ---- bonuses (полученные) ----
  const setBonus = (i: number, patch: Partial<{ description: string; bonus: number }>) => {
    const bonuses = [...(data.bonuses ?? [])];
    bonuses[i] = { ...bonuses[i], ...patch };
    onChange({ ...data, bonuses });
  };
  const addBonus = () =>
    onChange({ ...data, bonuses: [...(data.bonuses ?? []), { description: '', bonus: 0 }] });
  const removeBonus = (i: number) =>
    onChange({ ...data, bonuses: (data.bonuses ?? []).filter((_, j) => j !== i) });

  // ---- tasks (задания) ----
  const setTask = (i: number, patch: Partial<{ id: string; description: string; bonus: number }>) => {
    const tasks = [...(data.tasks ?? [])];
    tasks[i] = { ...tasks[i], ...patch };
    onChange({ ...data, tasks });
  };
  const addTask = () =>
    onChange({
      ...data,
      tasks: [
        ...(data.tasks ?? []),
        { id: crypto.randomUUID(), description: '', bonus: 0 },
      ],
    });
  const removeTask = (i: number) =>
    onChange({ ...data, tasks: (data.tasks ?? []).filter((_, j) => j !== i) });

  // ---- базовый редактор ----
  const handleGumshoeChange = useCallback(
    (next: BaseCharacterData) => {
      onChange({
        ...data,
        ...next,
        role:    data.role,
        bonuses: data.bonuses,
        tasks:   data.tasks,
      });
    },
    [data, onChange],
  );

  return (
    <div className="space-y-6">

      {/* Роль */}
      <div className="space-y-1">
        <div className="text-sm text-gray-300">Роль персонажа</div>
        <input
          type="text"
          value={data?.role ?? ''}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Детектив, эксперт, летописец..."
          className="w-full md:w-1/2 rounded border border-gray-700 bg-black/40 text-gray-100 text-sm px-2 py-1"
        />
      </div>

      {/* Задания */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-300">Задания</div>
          <button
            type="button"
            onClick={addTask}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-700 bg-black/40 text-gray-200 hover:border-gray-500"
          >
            <Plus className="w-3 h-3" /> добавить
          </button>
        </div>

        {(data?.tasks ?? []).length === 0 && (
          <div className="text-xs text-gray-500 italic">Заданий нет</div>
        )}

        {(data?.tasks ?? []).map((t, i) => (
          <div key={t.id ?? i} className="rounded border border-gray-700 bg-black/20 p-2 space-y-1.5">
            <div className="flex gap-2 items-start">
              {/* описание */}
              <textarea
                rows={2}
                value={t.description}
                onChange={(e) => setTask(i, { description: e.target.value })}
                placeholder="Описание задания (что сделать, за что выдаётся)"
                className="flex-1 rounded border border-gray-700 bg-black/40 text-gray-100 text-sm px-2 py-1 resize-none"
              />
              {/* бонус */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Input
                  type="number"
                  value={t.bonus}
                  onChange={(e) => setTask(i, { bonus: Number(e.target.value) || 0 })}
                  className="w-20 text-right"
                  placeholder="0"
                />
                <span className="text-[10px] text-gray-500">бонус</span>
              </div>
              {/* удалить */}
              <button
                type="button"
                onClick={() => removeTask(i)}
                className="mt-0.5 text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* id (readonly) */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-600">id:</span>
              <input
                type="text"
                value={t.id ?? ''}
                onChange={(e) => setTask(i, { id: e.target.value })}
                placeholder="уникальный ключ, напр. kill_robot"
                className="flex-1 rounded border border-gray-800 bg-black/30 text-gray-500 text-[11px] px-1.5 py-0.5"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Полученные бонусы (ручное редактирование) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-300">Полученные бонусы</div>
          <button
            type="button"
            onClick={addBonus}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-700 bg-black/40 text-gray-200 hover:border-gray-500"
          >
            <Plus className="w-3 h-3" /> добавить
          </button>
        </div>

        {(data?.bonuses ?? []).length === 0 && (
          <div className="text-xs text-gray-500 italic">Бонусов пока нет</div>
        )}

        {(data?.bonuses ?? []).map((b, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="text"
              value={b.description}
              onChange={(e) => setBonus(i, { description: e.target.value })}
              placeholder="Описание бонуса"
              className="flex-1 rounded border border-gray-700 bg-black/40 text-gray-100 text-sm px-2 py-1"
            />
            <Input
              type="number"
              value={b.bonus}
              onChange={(e) => setBonus(i, { bonus: Number(e.target.value) || 0 })}
              className="w-20 text-right"
            />
            <button
              type="button"
              onClick={() => removeBonus(i)}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Навыки — базовый компонент */}
      <BaseCharacterDataEditor
        data={data}
        config={config}
        issues={issues}
        onChange={handleGumshoeChange}
      />
    </div>
  );
}