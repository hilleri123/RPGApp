'use client';

import { useEffect, useMemo, useRef } from 'react';
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

type Props = {
  data: Record<string, any>;
  config?: SceneConfig;
  issues?: ValidationIssue[];
  onChange: (next: Record<string, any>) => void;
};

export default function SceneDataEditor({ data, config, onChange }: Props) {
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

      <p className="text-xs text-gray-500">
        В действии «Выполнить ход» игрокам доступны только ходы, подходящие к выбранному типу сцены.
      </p>
    </div>
  );
}
