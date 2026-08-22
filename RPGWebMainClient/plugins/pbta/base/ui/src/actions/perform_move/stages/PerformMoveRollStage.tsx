// ─── stages/PerformMoveRollStage.tsx ────────────────────────────────────────
// Бэк: pbta.perform_move.roll
// Input: roll_seed
"use client";
import React, { useEffect, useState } from "react";
import type { DiceInterpreter } from "plugins/common/ui";
import { RollStageShell } from "@/app/components/roll/RollStageShell";
import { parseMovesFromStageData, outcomeColor, primaryMoveRef } from "../types";
import { MoveCard } from "../components/MoveCard";

type Props = {
  action: any;
  value: any;
  patch: (next: Record<string, unknown>) => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  setSubmitEnabled: (e: boolean) => void;
};

export const pbtaRollInterpreter: DiceInterpreter = ({ total }) => {
  if (typeof total !== "number") return { dieColors: [], outcome: null };
  if (total >= 10) return { dieColors: ["good", "good"], outcome: { label: "10+", color: "good" } };
  if (total >= 7)  return { dieColors: ["mixed", "mixed"], outcome: { label: "7–9", color: "mixed" } };
  return { dieColors: ["bad", "bad"], outcome: { label: "6−", color: "bad" } };
};

export function PerformMoveRollStage({ action, value, patch, onSubmit, setSubmitEnabled, readOnly }: Props & { readOnly?: boolean }) {
  const wf = action?.workflow ?? {};
  const entry = wf?.context?.entry ?? {};
  const roll = entry?.roll ?? {};
  const rollSpec = wf?.stageData?.rollSpec ?? null;
  const primary = primaryMoveRef(entry);

  const [seed, setSeed] = useState<string | null>(null);

  useEffect(() => { setSubmitEnabled(false); }, [setSubmitEnabled]);

  const handleSeedChange = (s: string | null) => {
    if (readOnly) return;
    setSeed(s);
    patch({ roll_seed: s });
    setSubmitEnabled(!!s);
  };

  const allMoves = parseMovesFromStageData(action);
  const move = allMoves.find((m) => m.id === primary?.id) ?? null;

  const alreadyRolled = Array.isArray(roll?.dice) && roll.dice.length === 2;

  const summary = (
    <div className="rounded border border-white10 bg-zinc-950/20 p-3 text-sm space-y-1 font-mono">
      <div>Ход: <span className="text-white">{primary?.title || "—"}</span></div>
      <div>Стат: <span className="text-white">{(roll?.stat_id ?? "").toUpperCase()}</span>
        {" "}<span className="text-white40">({roll?.stat_value ?? "?"})</span></div>
    </div>
  );

  return (
    <RollStageShell
      summary={summary}
      rollSpec={rollSpec}
      interpreter={pbtaRollInterpreter}
      seed={seed}
      onSeedChange={handleSeedChange}
      onRoll={() => !readOnly && seed && onSubmit({ roll_seed: seed })}
      rollDisabled={alreadyRolled || !!readOnly}
      rolled={
        alreadyRolled
          ? {
              dice: roll.dice,
              total: roll.total ?? 0,
              seed: roll.roll_seed ?? null,
              resultText: roll.result_text ?? null,
              outcome: roll.outcome ?? null,
            }
          : null
      }
      footer={
        move ? (
          <div className={roll?.outcome ? outcomeColor(roll.outcome) : undefined}>
            <MoveCard move={move} outcome={roll?.outcome} resultText={roll?.result_text} />
          </div>
        ) : null
      }
    />
  );
}
