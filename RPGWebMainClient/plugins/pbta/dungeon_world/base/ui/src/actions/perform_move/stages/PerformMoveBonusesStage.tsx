'use client';

import React, { useEffect, useMemo } from 'react';
import { Sparkles, Package } from 'lucide-react';
import { extractMoveResolution } from '../components/moveResolution';
import { MoveResolutionCard } from '../components/MoveResolutionCard';

export function PerformMoveBonusesStage({ action, value, patch, onPatch, onSubmit, setSubmitEnabled, readOnly }: any) {
  const wf = action?.workflow ?? {};
  const stageData = wf?.stageData ?? {};
  const options = useMemo(
    () => (Array.isArray(stageData.bonusOptions) ? stageData.bonusOptions : []),
    [stageData.bonusOptions],
  );
  const moveResources = useMemo(
    () => (Array.isArray(stageData.moveResourceOptions) ? stageData.moveResourceOptions : []),
    [stageData.moveResourceOptions],
  );

  const selected: string[] = Array.isArray(value?.consume_bonus_ids)
    ? value.consume_bonus_ids
    : Array.isArray(stageData.selectedBonusIds)
      ? stageData.selectedBonusIds
      : [];

  const moveInfo = useMemo(() => extractMoveResolution(action), [action]);

  useEffect(() => {
    setSubmitEnabled(true);
  }, [setSubmitEnabled]);

  const syncPatch = (next: Record<string, unknown>) => {
    patch(next);
    onPatch?.(next);
  };

  const toggle = (id: string) => {
    if (readOnly) return;
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    const total = options
      .filter((o: any) => next.includes(o.id) && o.consume_on === 'roll')
      .reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);
    syncPatch({ consume_bonus_ids: next, resource_bonus_total: total });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <MoveResolutionCard data={moveInfo} />
      <div className="font-medium flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-300" />
        Бонусы к броску
      </div>

      {moveResources.length > 0 && (
        <div className="rounded border border-cyan-400/30 bg-cyan-500/5 p-3 space-y-2">
          <div className="text-xs uppercase tracking-wide text-cyan-200/80 flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            Ресурсы выбранного хода
          </div>
          <div className="flex flex-wrap gap-2">
            {moveResources.map((res: any) => (
              <span
                key={res.id}
                className="rounded-full border border-cyan-400/50 bg-cyan-500/15 px-3 py-1 text-sm text-cyan-100"
              >
                {res.description || res.spec_id}
                <span className="ml-2 font-mono text-cyan-200">×{res.amount}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {options.length === 0 ? (
        <div className="text-sm text-white/50">Нет доступных бонусов к броску для этого хода.</div>
      ) : (
        <div className="space-y-2">
          {options.map((opt: any) => {
            const highlighted = opt.matches_move !== false;
            return (
              <label
                key={opt.id}
                className={`flex items-center gap-2 rounded border px-3 py-2 text-sm cursor-pointer ${
                  highlighted
                    ? 'border-amber-400/50 bg-amber-500/10'
                    : 'border-white/10 bg-zinc-950/20 opacity-70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.id)}
                  onChange={() => toggle(opt.id)}
                  disabled={readOnly}
                />
                <span className="text-white">{opt.description || opt.spec_id}</span>
                <span className="text-emerald-300 font-mono ml-auto">+{opt.amount}</span>
              </label>
            );
          })}
        </div>
      )}
      <button
        type="button"
        disabled={readOnly}
        onClick={() =>
          onSubmit({
            consume_bonus_ids: selected,
            resource_bonus_total: Number(value?.resource_bonus_total || 0),
          })
        }
        className="rounded border border-amber-400/50 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
      >
        Продолжить
      </button>
    </div>
  );
}
