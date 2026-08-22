// ─── PerformMoveStage.tsx ────────────────────────────────────────────────────
"use client";
import React from "react";
import type { ActionHandlerProps } from "app/plugins/pluginTypes";
import { isPerformMoveAction } from "./types";
import { PerformMoveSetupStage }   from "./stages/PerformMoveSetupStage";
import { PerformMoveDeclareStage } from "./stages/PerformMoveDeclareStage";
import { PerformMoveAidStage }     from "./stages/PerformMoveAidStage";
import { PerformMoveRollStage }    from "./stages/PerformMoveRollStage";
import { PerformMoveChooseStage }  from "./stages/PerformMoveChooseStage";
import { PerformMoveResultStage }  from "./stages/PerformMoveResultStage";
import { PerformMoveResolveStage } from "./stages/PerformMoveResolveStage";

export default function PerformMoveStage(props: ActionHandlerProps) {
  const {
    action,
    user_id,
    value,
    onChange,
    onPatch,
    onSubmit,
    setSubmitEnabled,
    stageKey: viewKeyProp,
    readOnly = false,
  } = props;

  if (!isPerformMoveAction(action)) {
    return <div className="text-sm text-red-300/80">action key mismatch: pbta.perform_move</div>;
  }

  const stageKey = String(viewKeyProp ?? action?.workflow?.stageKey ?? "completed");

  const patch = (p: Record<string, unknown>) => {
    if (readOnly) return;
    onChange({ ...(value ?? {}), ...p });
  };

  const syncPatch = (p: Record<string, unknown>) => {
    if (readOnly) return;
    patch(p);
    onPatch?.(p);
  };

  const stageProps = {
    user_id,
    action,
    value: value ?? {},
    patch,
    onPatch: readOnly ? undefined : syncPatch,
    onSubmit,
    setSubmitEnabled,
    readOnly,
  };

  if (stageKey === "perform_move.setup") return <PerformMoveSetupStage {...stageProps} />;
  if (stageKey === "perform_move.declare") return <PerformMoveDeclareStage {...stageProps} />;
  if (stageKey === "perform_move.aid") return <PerformMoveAidStage {...stageProps} />;
  if (stageKey === "perform_move.roll") return <PerformMoveRollStage {...stageProps} />;
  if (stageKey === "perform_move.resolve") return <PerformMoveResolveStage {...stageProps} />;
  if (stageKey === "perform_move.choose") return <PerformMoveChooseStage {...stageProps} />;
  if (stageKey === "perform_move.result" || stageKey === "completed") {
    return <PerformMoveResultStage action={action} onSubmit={onSubmit} setSubmitEnabled={setSubmitEnabled} />;
  }

  return <div className="text-sm text-white/50">{stageKey}</div>;
}
