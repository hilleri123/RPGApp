// ─── stages/PerformMoveResultStage.tsx ──────────────────────────────────────
// Бэк: pbta.perform_move.result / completed
"use client";
import React, { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { getSceneBundle } from "plugins/common/types/actionSelectors";
import {
  getActorName,
  getTargetName,
  outcomeLabel,
  outcomeColor,
  type EffectRecord,
  entryResolve,
  primaryMoveRef,
} from "../types";
import { parseMovesFromStageData } from "../types";
import { MoveCard } from "../components/MoveCard";

type Props = {
  action: any;
  onSubmit: (payload: Record<string, unknown>) => void;
  setSubmitEnabled: (e: boolean) => void;
};

function EffectBadge({ effect }: { effect: EffectRecord }) {
  const p = effect.payload;

  if (effect.kind === "gm_directive" && p?.["complication"]) {
    return (
      <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
        <span className="text-xs uppercase tracking-wide text-amber-300/80 mr-2">Косяк:</span>
        {String(p?.["text"] ?? effect.text)}
      </div>
    );
  }

  if (effect.kind === "gm_directive") {
    return (
      <div className="rounded border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200">
        <span className="text-xs uppercase tracking-wide text-indigo-300/70 mr-2">GM:</span>
        {String(p?.["text"] ?? effect.text)}
      </div>
    );
  }

  if (effect.kind === "grant_bonus") {
    const bonus = p?.["bonus"] as Record<string, unknown> | null | undefined;
    const desc  = bonus?.["description"];
    const kind  = bonus?.["kind"];
    const amt   = Number(bonus?.["amount"] ?? 0);
    const label = desc
      ? String(desc)
      : `${String(kind ?? "")} ${amt >= 0 ? "+" : ""}${amt}`;
    return (
      <div className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
        <span className="text-xs uppercase tracking-wide text-amber-300/70 mr-2">Бонус:</span>
        {label}
      </div>
    );
  }

  if (effect.kind === "grant_resource") {
    const resourceId = String(p?.["resource_id"] ?? "");
    const amount     = Number(p?.["amount"] ?? 1);
    return (
      <div className="rounded border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
        <span className="text-xs uppercase tracking-wide text-cyan-300/70 mr-2">Hold:</span>
        {resourceId} ×{amount}
      </div>
    );
  }

  if (effect.kind.startsWith("unhandled:")) {
    return (
      <div className="rounded border border-white10 px-3 py-2 text-sm text-white50">
        {effect.text || effect.kind}
      </div>
    );
  }

  return (
    <div className="rounded border border-white10 px-3 py-2 text-sm text-white70">
      {effect.text || effect.kind}
    </div>
  );
}


export function PerformMoveResultStage({ action, onSubmit, setSubmitEnabled }: Props) {
  const scene = getSceneBundle(action);
  const wf = action?.workflow ?? {};
  const entry = wf?.context?.entry ?? {};
  const roll = entry?.roll ?? {};
  const primary = primaryMoveRef(entry);
  const completed = wf?.stageKey === "completed" || wf?.status === "completed";

  const allMoves = parseMovesFromStageData(action);
  const move = allMoves.find((m) => m.id === primary?.id) ?? null;

  const resolved = entryResolve(entry);
  const logLines: string[] = resolved.log_lines;
  const effects: EffectRecord[] = resolved.effects;

  useEffect(() => { setSubmitEnabled(!completed); }, [completed, setSubmitEnabled]);

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <div className="font-medium flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
        Результат хода
      </div>

      {/* Кто / что */}
      <div className="rounded border border-white10 bg-zinc-950/20 p-3 text-sm space-y-1">
        <div>Актор: <span className="text-white">{getActorName(scene, entry)}</span></div>
        {entry?.target_kind !== "none" && (
          <div>Цель: <span className="text-white">{getTargetName(scene, entry)}</span></div>
        )}
        <div>Ход: <span className="text-white">{primary?.title || "—"}</span></div>
        {roll?.stat_id && (
          <div className="font-mono">
            {roll.stat_id.toUpperCase()} {roll.stat_value}{" "}
            <span className="text-white40">
              мод {roll.base_modifier >= 0 ? "+" : ""}{roll.base_modifier}
            </span>
          </div>
        )}
        {Array.isArray(roll?.dice) && roll.dice.length === 2 && (
          <div className="font-mono">
            Кубики: <span className="text-white">{roll.dice[0]}+{roll.dice[1]}</span>
            {" "}= <span className="text-white">{roll.total}</span>
            {roll.outcome && (
              <span className={`ml-2 font-semibold ${outcomeColor(roll.outcome)}`}>
                {outcomeLabel(roll.outcome)}
              </span>
            )}
          </div>
        )}
        {roll?.result_text && (
          <div className={`font-mono text-xs ${outcomeColor(roll?.outcome)}`}>
            {roll.result_text}
          </div>
        )}
      </div>

      {/* Карточка хода */}
      {move && (
        <MoveCard
          move={move}
          outcome={roll?.outcome}
          resultText={null}
        />
      )}

      {/* Лог-строки (нарративный результат) */}
      {logLines.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-white60">Эффект</div>
          {logLines.map((line, i) => (
            <div
              key={i}
              className="rounded border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 whitespace-pre-wrap"
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Структурные эффекты */}
      {effects.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-white60">Механические эффекты</div>
          {effects.map((eff, i) => (
            <EffectBadge key={i} effect={eff} />
          ))}
        </div>
      )}

      {!completed && (
        <button
          type="button"
          onClick={() => onSubmit({})}
          className="rounded border border-emerald-400/70 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10"
        >
          Завершить
        </button>
      )}
      {completed && (
        <div className="text-sm text-emerald-300/80">Ход завершён.</div>
      )}
    </div>
  );
}