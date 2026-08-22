'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import type { CharacterData } from '../types/character';
import type { CustomMove, PbtaSkill, ResourceSpec } from '../types/pbta';
import { customMoveToMove } from '../types/pbta';
import { MoveExpandable, toMoveDisplayData } from './moves';
import { MoveGrantResourcesEditor } from './MoveGrantResourcesEditor';
import { statScoresForMove } from '../lib/pbta';

type Props = {
  data: CharacterData;
  skills: PbtaSkill[];
  currentStats: Record<string, number>;
  resourceSpecs?: ResourceSpec[];
  onChange: (next: CharacterData) => void;
};

function newCustomMoveId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `custom_${crypto.randomUUID()}`;
  }
  return `custom_${Date.now()}`;
}

export function CustomMovesEditor({ data, skills, currentStats, resourceSpecs = [], onChange }: Props) {
  const customMoves = data.custom_moves ?? [];
  const activeIds = useMemo(() => new Set(data.moves ?? []), [data.moves]);

  const updateMoves = (nextCustom: CustomMove[]) => {
    onChange({ ...structuredClone(data), custom_moves: nextCustom });
  };

  const addMove = () => {
    const cm: CustomMove = {
      id: newCustomMoveId(),
      title: 'Новый ход',
      available_stats: skills[0]?.id ? [skills[0].id] : [],
    };
    const next = [...customMoves, cm];
    const moves = [...(data.moves ?? [])];
    if (!moves.includes(cm.id)) moves.push(cm.id);
    onChange({ ...structuredClone(data), custom_moves: next, moves });
  };

  const patchMove = (id: string, patch: Partial<CustomMove>) => {
    updateMoves(customMoves.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const removeMove = (id: string) => {
    const nextCustom = customMoves.filter((m) => m.id !== id);
    const moves = (data.moves ?? []).filter((mid) => mid !== id);
    onChange({ ...structuredClone(data), custom_moves: nextCustom, moves });
  };

  const toggleActive = (id: string, checked: boolean) => {
    const moves = [...(data.moves ?? [])];
    if (checked) {
      if (!moves.includes(id)) moves.push(id);
    } else {
      const idx = moves.indexOf(id);
      if (idx >= 0) moves.splice(idx, 1);
    }
    onChange({ ...structuredClone(data), moves });
  };

  const toggleStat = (moveId: string, statId: string, checked: boolean) => {
    const cm = customMoves.find((m) => m.id === moveId);
    if (!cm) return;
    const stats = new Set(cm.available_stats ?? []);
    if (checked) stats.add(statId);
    else stats.delete(statId);
    patchMove(moveId, { available_stats: [...stats] });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm text-gray-300">Кастомные ходы</div>
          <div className="text-[11px] text-gray-500">
            Создайте свой ход и используйте его в действии «Сделать ход», как обычные ходы.
          </div>
        </div>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border border-amber-700/60 bg-amber-950/30 text-amber-200 hover:border-amber-500"
          onClick={addMove}
        >
          + Добавить ход
        </button>
      </div>

      {customMoves.length === 0 && (
        <div className="text-xs text-gray-500 border border-dashed border-gray-700 rounded p-3">
          Пока нет кастомных ходов.
        </div>
      )}

      <div className="space-y-3">
        {customMoves.map((cm) => {
          const move = customMoveToMove(cm);
          const active = activeIds.has(cm.id);
          return (
            <div
              key={cm.id}
              className="rounded border border-amber-800/40 bg-amber-950/10 p-3 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={cm.title}
                  onChange={(e) => patchMove(cm.id, { title: e.target.value })}
                  className="flex-1 min-w-[12rem] text-sm"
                  placeholder="Название хода"
                />
                <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => toggleActive(cm.id, e.target.checked)}
                  />
                  Активен
                </label>
                <button
                  type="button"
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => removeMove(cm.id)}
                >
                  Удалить
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] uppercase text-gray-500 w-full">Статы для броска</span>
                {skills.map((s) => {
                  const checked = (cm.available_stats ?? []).includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`text-xs px-2 py-0.5 rounded border cursor-pointer ${checked ? 'border-amber-600 text-amber-200 bg-amber-950/40' : 'border-gray-700 text-gray-500'}`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={(e) => toggleStat(cm.id, s.id, e.target.checked)}
                      />
                      {s.title ?? s.id.toUpperCase()}
                    </label>
                  );
                })}
              </div>

              <TextArea
                label="Триггер"
                value={cm.trigger ?? ''}
                onChange={(v) => patchMove(cm.id, { trigger: v })}
              />
              <TextArea
                label="Эффект (общий)"
                value={cm.effect ?? ''}
                onChange={(v) => patchMove(cm.id, { effect: v })}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <TextArea
                  label="10+"
                  value={cm.effect_10_plus ?? ''}
                  onChange={(v) => patchMove(cm.id, { effect_10_plus: v })}
                />
                <TextArea
                  label="7–9"
                  value={cm.effect_7_9 ?? ''}
                  onChange={(v) => patchMove(cm.id, { effect_7_9: v })}
                />
                <TextArea
                  label="6−"
                  value={cm.effect_6_minus ?? ''}
                  onChange={(v) => patchMove(cm.id, { effect_6_minus: v })}
                />
              </div>

              <div className="space-y-1 border-t border-amber-900/30 pt-2">
                <div className="text-[10px] uppercase text-gray-500">Ресурсы хода</div>
                <MoveGrantResourcesEditor
                  grants={cm.grant_resources ?? []}
                  resourceSpecs={resourceSpecs}
                  skills={skills}
                  onChange={(grant_resources) => patchMove(cm.id, { grant_resources })}
                />
              </div>

              <MoveExpandable
                move={toMoveDisplayData(move)}
                checked={active}
                isStarting={false}
                statScores={statScoresForMove(move, currentStats)}
                skills={skills}
                onToggle={(c) => toggleActive(cm.id, c)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-gray-500">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded border border-gray-700 bg-black/40 text-gray-100 text-xs px-2 py-1.5 resize-y min-h-[2.5rem]"
      />
    </div>
  );
}
