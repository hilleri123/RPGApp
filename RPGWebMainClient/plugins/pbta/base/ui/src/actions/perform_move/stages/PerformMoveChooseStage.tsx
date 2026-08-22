// ─── stages/PerformMoveChooseStage.tsx ──────────────────────────────────────
// Бэк: pbta.perform_move.choose
// Input: choices[{ choice_id, option_ids[] }]
"use client";
import React, { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { parseMovesFromStageData, outcomeColor, entryResolve, primaryMoveRef, type PendingChoice } from "../types";
import { MoveCard } from "../components/MoveCard";

type Props = {
  action: any;
  value: any;
  patch: (next: Record<string, unknown>) => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  setSubmitEnabled: (e: boolean) => void;
};

export function PerformMoveChooseStage({ action, value, patch, onSubmit, setSubmitEnabled }: Props) {
  const entry = action?.workflow?.context?.entry ?? {};
  const roll = entry?.roll ?? {};
  const primary = primaryMoveRef(entry);
  const pendingChoices: PendingChoice[] = entryResolve(entry).pending_choices.filter(
    (c: PendingChoice) => !c.resolved
  );

  // локальный стейт: choice_id → выбранные option_ids
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    pendingChoices.forEach((c) => { init[c.id] = []; });
    return init;
  });

  const allMoves = parseMovesFromStageData(action);
  const move = allMoves.find((m) => m.id === primary?.id) ?? null;

  // Валидность: каждый выбор заполнен ровно на `choose` вариантов
  const valid = pendingChoices.every((c) => {
    const sel = selections[c.id] ?? [];
    return sel.length === c.choose;
  });

  useEffect(() => { setSubmitEnabled(valid); }, [valid, setSubmitEnabled]);

  const toggle = (choiceId: string, optionId: string, choose: number) => {
    setSelections((prev) => {
      const cur = prev[choiceId] ?? [];
      if (choose === 1) {
        return { ...prev, [choiceId]: [optionId] };
      }
      if (cur.includes(optionId)) {
        return { ...prev, [choiceId]: cur.filter((x) => x !== optionId) };
      }
      if (cur.length < choose) {
        return { ...prev, [choiceId]: [...cur, optionId] };
      }
      return prev;
    });
  };

  const handleSubmit = () => {
    const choices = pendingChoices.map((c) => ({
      choice_id: c.id,
      option_ids: selections[c.id] ?? [],
    }));
    onSubmit({ choices });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <div className="font-medium flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-amber-300" />
        Выбор
      </div>

      <MoveCard move={move} outcome={roll?.outcome} resultText={roll?.result_text} />

      {pendingChoices.map((choice) => (
        <div key={choice.id} className="rounded border border-white10 p-3 space-y-2">
          <div className="text-sm text-white80 font-medium">
            {choice.prompt || "Выбери вариант"}
            {choice.choose > 1 && (
              <span className="ml-2 text-xs text-white40">
                выбери {choice.choose} из {choice.options.length}
              </span>
            )}
          </div>

          <div className="space-y-1">
            {choice.options.map((opt) => {
              const sel = selections[choice.id] ?? [];
              const checked = sel.includes(opt.id);
              const disabled = !checked && sel.length >= choice.choose;
              return (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2 text-sm rounded border px-3 py-2 cursor-pointer ${
                    checked
                      ? "border-amber-400/50 bg-amber-500/10 text-amber-100"
                      : disabled
                      ? "border-white10 text-white30 cursor-not-allowed"
                      : "border-white10 text-white70 hover:bg-white/5"
                  }`}
                >
                  <input
                    type={choice.choose === 1 ? "radio" : "checkbox"}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(choice.id, opt.id, choice.choose)}
                    className="mt-0.5"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <button
        type="button"
        disabled={!valid}
        onClick={handleSubmit}
        className={`rounded border px-3 py-2 text-sm font-semibold ${
          valid
            ? "border-amber-400/70 text-amber-200 hover:bg-amber-500/10"
            : "border-white10 text-white30 cursor-not-allowed"
        }`}
      >
        Подтвердить выбор
      </button>
    </div>
  );
}