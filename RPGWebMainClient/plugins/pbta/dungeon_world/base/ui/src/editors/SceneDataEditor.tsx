'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Play, Trash2 } from 'lucide-react';
import type { ValidationIssue } from '../../../../../base/ui/src/types';
import {
  MODE_HINT,
  MODE_LABEL,
  MODE_MOVE_EXAMPLES,
  normalizeSceneMode,
  type SceneConfig,
  type SceneMode,
} from '../shared/sceneModes';
import { SceneModeIcon } from '../shared/SceneModeIcon';
import {
  EMPTY_INITIATIVE,
  entityNameMap,
  insertByValue,
  reorderInitiative,
  readInitiative,
  removeFromInitiative,
  sceneEntities,
  type SceneInitiative,
} from '../shared/initiative';

type Props = {
  data: Record<string, any>;
  /** Сцена целиком: из неё берутся имена и список тех, кого можно добавить в очередь. */
  scene?: Record<string, any>;
  config?: SceneConfig;
  issues?: ValidationIssue[];
  onChange: (next: Record<string, any>) => void;
};

export default function SceneDataEditor({ data, scene, config, onChange }: Props) {
  const initKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const init = config?.initialData;
    if (!init) return;
    const key = 'dw-scene';
    if (initKeyRef.current === key) return;
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      initKeyRef.current = key;
      return;
    }
    initKeyRef.current = key;
    onChange({ mode: init.mode ?? 'action' });
  }, [config, data, onChange]);

  const sceneModes = (config?.sceneModes ?? ['travel', 'camp', 'action']) as SceneMode[];
  const mode = normalizeSceneMode(data?.mode);

  const setMode = (next: SceneMode) => onChange({ ...data, mode: next });

  // --- очередь ходов ---
  const initiative = readInitiative(data);
  const names = useMemo(() => entityNameMap(scene), [scene]);
  const candidates = useMemo(
    () => sceneEntities(scene).filter((e) => !initiative.order.includes(e.id)),
    [scene, initiative.order],
  );
  const [newId, setNewId] = useState('');
  const [newValue, setNewValue] = useState('0');

  const setInitiative = (next: SceneInitiative) => onChange({ ...data, initiative: next });

  const addParticipant = () => {
    const id = newId || candidates[0]?.id;
    if (!id) return;
    const value = Number.parseInt(newValue, 10);
    setInitiative(insertByValue(initiative, id, Number.isFinite(value) ? value : 0));
    setNewId('');
    setNewValue('0');
  };

  const setValue = (id: string, raw: string) => {
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value)) return;
    setInitiative({ ...initiative, values: { ...initiative.values, [id]: value } });
  };

  const hint = useMemo(() => MODE_HINT[mode] ?? '', [mode]);
  const examples = MODE_MOVE_EXAMPLES[mode] ?? [];

  return (
    <div className="space-y-4 text-sm text-gray-200">
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Тип сцены</div>
        <div className="flex flex-wrap gap-2">
          {sceneModes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                mode === m
                  ? 'border-violet-500/60 bg-violet-500/15 text-violet-100'
                  : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
              }`}
            >
              <SceneModeIcon mode={m} />
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        {hint ? <p className="text-xs text-gray-500 mt-2">{hint}</p> : null}
      </div>

      {examples.length > 0 ? (
        <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-1">
          <div className="text-xs text-gray-400">Примеры ходов для этого типа</div>
          <ul className="text-xs text-gray-300 list-disc pl-4 space-y-0.5">
            {examples.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {mode !== 'action' ? (
        <p className="rounded border border-gray-700 bg-black/20 p-3 text-xs text-gray-400">
          В лагере и в пути очередь ходов не ведётся.
          {initiative.order.length
            ? ' Ранее брошенная очередь сохранена и вернётся, когда сцена снова станет «Действием».'
            : ''}
        </p>
      ) : (
        <>
      <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-gray-500">Очередь ходов</div>
          {initiative.order.length ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <label className="flex items-center gap-1">
                Раунд
                <input
                  type="number"
                  min={1}
                  value={initiative.round}
                  onChange={(e) =>
                    setInitiative({ ...initiative, round: Math.max(1, Number.parseInt(e.target.value, 10) || 1) })
                  }
                  className="w-14 rounded border border-gray-700 bg-gray-900 px-1 py-0.5 text-gray-100"
                />
              </label>
              <button
                type="button"
                className="rounded border border-gray-700 px-2 py-0.5 hover:border-red-500/60 hover:text-red-300"
                onClick={() => setInitiative(EMPTY_INITIATIVE)}
              >
                Очистить
              </button>
            </div>
          ) : null}
        </div>

        {initiative.order.length === 0 ? (
          <p className="text-xs text-gray-500">
            Порядок не задан. Бросить инициативу можно действием «Инициатива» (2d6 + ЛОВ), либо добавить участников
            вручную ниже.
          </p>
        ) : (
          <ol className="space-y-1">
            {initiative.order.map((id, idx) => {
              const ref = names[id];
              const isActive = idx === initiative.active_index;
              return (
                <li
                  key={id}
                  className={`flex items-center gap-2 rounded border px-2 py-1 ${
                    isActive ? 'border-rose-500/60 bg-rose-500/10' : 'border-gray-700 bg-gray-900/40'
                  }`}
                >
                  <span className="w-5 text-xs tabular-nums text-gray-500">{idx + 1}</span>
                  <span className={`flex-1 truncate ${ref ? 'text-gray-100' : 'text-gray-500'}`}>
                    {ref?.name ?? 'Нет в сцене'}
                    {ref?.kind === 'npc' ? <span className="ml-1 text-xs text-gray-500">NPC</span> : null}
                  </span>
                  <input
                    type="number"
                    title="Итог броска (2d6 + ЛОВ)"
                    value={initiative.values[id] ?? ''}
                    onChange={(e) => setValue(id, e.target.value)}
                    className="w-14 rounded border border-gray-700 bg-gray-900 px-1 py-0.5 text-center text-gray-100"
                  />
                  <button
                    type="button"
                    title="Сделать активным"
                    disabled={isActive}
                    className="p-1 text-gray-400 hover:text-rose-300 disabled:text-rose-400"
                    onClick={() => setInitiative({ ...initiative, active_index: idx })}
                  >
                    <Play size={14} />
                  </button>
                  <button
                    type="button"
                    title="Выше"
                    disabled={idx === 0}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                    onClick={() => setInitiative(reorderInitiative(initiative, idx, -1))}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    title="Ниже"
                    disabled={idx === initiative.order.length - 1}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                    onClick={() => setInitiative(reorderInitiative(initiative, idx, 1))}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    title="Убрать из очереди"
                    className="p-1 text-gray-400 hover:text-red-300"
                    onClick={() => setInitiative(removeFromInitiative(initiative, id))}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {candidates.length ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
            >
              <option value="">Добавить в очередь…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.kind === 'npc' ? ' (NPC)' : ''}
                </option>
              ))}
            </select>
            <input
              type="number"
              title="Итог броска: по нему участник встанет в очередь"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-16 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-sm text-gray-100"
            />
            <button
              type="button"
              disabled={!newId}
              onClick={addParticipant}
              className="rounded border border-violet-500/60 bg-violet-500/15 px-3 py-1 text-sm text-violet-100 disabled:opacity-40"
            >
              Добавить
            </button>
          </div>
        ) : null}

        <p className="text-xs text-gray-500">
          После хода активного участника (действие «Выполнить ход») очередь передаётся дальше сама. Ходы «не по
          очереди» её не сдвигают.
        </p>
      </div>
        </>
      )}

      <p className="text-xs text-gray-500">
        В действии «Выполнить ход» игрокам доступны только ходы, подходящие к выбранному типу сцены.
      </p>
    </div>
  );
}
