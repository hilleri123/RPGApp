'use client';

import { useEffect, useMemo, useState } from 'react';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import type { ScenarioTag } from '@/app/services/types2';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Props = {
  scenarioId: string;
  value: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
  /** Keep built-in checkboxes (enemy etc.) separate; this is pool tags. */
  className?: string;
};

export function ScenarioTagPicker({ scenarioId, value, onChange, readOnly, className }: Props) {
  const api = useMemo(() => new ScenarioScopedApiService(scenarioId), [scenarioId]);
  const [pool, setPool] = useState<ScenarioTag[]>([]);
  const selected = useMemo(() => new Set((value ?? []).map(String)), [value]);

  useEffect(() => {
    void api.getScenarioTags().then(setPool).catch(() => setPool([]));
  }, [api]);

  const toggle = (key: string, kind: string) => {
    if (readOnly || kind === 'front') return;
    if (selected.has(key)) {
      onChange(value.filter((t) => t !== key));
    } else {
      onChange([...(value ?? []), key]);
    }
  };

  const orphanKeys = (value ?? []).filter((k) => !pool.some((p) => p.key === k));

  return (
    <div className={cn('space-y-2', className)}>
      <div className="text-xs text-gray-400">Тэги сценария</div>
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap gap-2">
          {pool.map((t) => {
            const active = selected.has(t.key);
            const locked = t.kind === 'front';
            return (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={readOnly || locked}
                    onClick={() => toggle(t.key, t.kind)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs transition',
                      active ? 'text-white' : 'text-gray-400 opacity-70',
                      locked && 'cursor-default',
                    )}
                    style={{
                      borderColor: t.color || '#52525b',
                      backgroundColor: active ? `${t.color || '#7c3aed'}33` : 'transparent',
                    }}
                  >
                    {t.label || t.key}
                    {locked ? ' 🔒' : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <div className="font-mono text-[10px] text-gray-400 mb-0.5">{t.key}</div>
                  {t.description || (locked ? 'Тэг фронта — снимается через Фронт' : 'Без описания')}
                </TooltipContent>
              </Tooltip>
            );
          })}
          {orphanKeys.map((k) => (
            <button
              key={k}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(value.filter((t) => t !== k))}
              className="rounded-md border border-amber-700/50 bg-amber-950/30 px-2 py-1 text-xs text-amber-200"
              title="Нет в пуле — нажмите, чтобы снять"
            >
              {k} ×
            </button>
          ))}
          {!pool.length && !orphanKeys.length ? (
            <span className="text-xs text-gray-500">Пул пуст — создайте тэги в Настройках</span>
          ) : null}
        </div>
      </TooltipProvider>
    </div>
  );
}
