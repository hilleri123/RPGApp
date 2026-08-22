'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dices } from 'lucide-react';
import { CanvasSeed } from '@/plugins/common/ui/CanvasSeed';
import { log } from 'console';

export function TerrifyRollStage({ user_id, action, value, onSubmit, setSubmitEnabled }: any) {
  const wf = action?.workflow ?? {};
  const ctx = wf?.context ?? {};
  const targets: any[] = ctx?.targets ?? [];
  const participants = action?.participants ?? {};
  const isGm = String(participants?.gmUserId ?? '') === String(user_id);
  const isDone = wf?.stageKey === 'gumshoe.terrify.result' || wf?.stageKey === 'completed';

  const myTargets = useMemo(
    () => targets.filter((t: any) => isGm || String(t.userId ?? '') === String(user_id)),
    [targets, isGm, user_id]
  );

  const [seeds, setSeeds] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    for (const t of myTargets) init[t.characterId] = t.canvas_seed ?? null;
    return init;
  });

  const [spentStability, setSpentStability] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const t of myTargets) init[t.characterId] = 0;
    return init;
  });

  useEffect(() => {
    const canSubmit = !isDone && !isGm && myTargets.length > 0;
    setSubmitEnabled(canSubmit);
  }, [isDone, isGm, myTargets.length, setSubmitEnabled]);

  const handleSpend = (charId: string, max: number, v: number) => {
    const next = Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0));
    setSpentStability((prev) => ({ ...prev, [charId]: next }));
  };

  const handleSubmit = () => {
    if (isDone || isGm) return;

    onSubmit({
      user_id,
      seeds,
      spentStability,
    });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <Dices className="w-4 h-4 text-purple-400" />
        Terrify — броски
      </div>

      <div className="flex flex-col gap-3">
        {isGm ? (
          myTargets.map((t: any) => {
            const charId = t.characterId;
            const hasRolled = Boolean(t.canvas_seed || t.dice?.length);

            return (
              <div key={charId} className="rounded border border-white/10 p-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white/80">
                    {t.name || `Персонаж ${charId.slice(0, 6)}`}
                  </span>
                  <span className="text-xs text-white/40">
                    {hasRolled ? 'уже кинул' : 'ещё не кинул'}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          myTargets.map((t: any) => {
            const charId = t.characterId;
            const character = (action?.scene?.scene?.characters || []).find((c: any) => c.id === charId);

            const stability = character?.data?.skills?.["stability"] ?? 0;
            const spent = spentStability[charId] ?? 0;

            return (
              <div key={charId} className="rounded border border-white/10 p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/80">
                    {t.name || `Персонаж ${charId.slice(0, 6)}`}
                  </span>
                  <span className="text-xs text-white/40">
                    stability: {stability}
                  </span>
                </div>

                {!isDone && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs text-white/40">Тратить stability:</label>
                    <input
                      type="number"
                      min={0}
                      max={stability}
                      value={spent}
                      onChange={(e) => handleSpend(charId, stability, Number(e.target.value))}
                      className="w-24 rounded border border-white/10 bg-transparent px-2 py-1 text-sm outline-none"
                    />
                    <span className="text-xs text-white/40">из {stability}</span>
                  </div>
                )}

                {!isDone && (
                  <CanvasSeed
                    onChange={(seed) =>
                      setSeeds((prev) => ({
                        ...prev,
                        [charId]: seed,
                      }))
                    }
                    hint="Нарисуй seed."
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {!isGm && myTargets.length > 0 && !isDone && (
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded border border-purple-400/70 px-3 py-2 text-sm font-semibold text-purple-200 hover:bg-purple-500/10"
        >
          Подтвердить
        </button>
      )}
    </div>
  );
}
