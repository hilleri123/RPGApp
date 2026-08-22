// ─── stages/PerformMoveAidStage.tsx ─────────────────────────────────────────
// Бэк: pbta.perform_move.aid
// Input: request_aid, helper_character_id, accept
"use client";
import React, { useEffect } from "react";
import { Users } from "lucide-react";
import { getSceneBundle } from "plugins/common/types/actionSelectors";
import { getActorName } from "../types";

type Props = {
  action: any;
  user_id: string;
  value: any;
  patch: (next: Record<string, unknown>) => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  setSubmitEnabled: (e: boolean) => void;
};

export function PerformMoveAidStage({ action, value, patch, onSubmit, setSubmitEnabled }: Props) {
  const { scene } = getSceneBundle(action);
  const entry = action?.workflow?.context?.entry ?? {};

  const actorCharacterId = String(entry?.actor_character_id ?? "");
  const requestAid = !!value?.request_aid;
  const helperCharacterId: string = value?.helper_character_id ?? "";

  const helpers = (scene?.characters ?? []).filter(
    (ch: any) => String(ch.id) !== actorCharacterId
  );

  const valid = !requestAid || !!helperCharacterId;
  useEffect(() => { setSubmitEnabled(valid); }, [valid, setSubmitEnabled]);

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <div className="font-medium flex items-center gap-2">
        <Users className="w-4 h-4 text-emerald-300" />
        Помощь
      </div>

      <div className="text-sm text-white70">
        <span className="text-white">{getActorName(scene, entry)}</span> совершает ход.
        Нужна ли помощь другого персонажа?
      </div>

      <label className="flex items-center gap-2 text-sm text-white80 cursor-pointer">
        <input
          type="checkbox"
          checked={requestAid}
          onChange={(e) => patch({ request_aid: e.target.checked, helper_character_id: null })}
        />
        Попросить помощь
      </label>

      {requestAid && (
        <div className="space-y-2">
          <div className="text-sm text-white60">Помощник</div>
          <select
            className="w-full rounded border bg-zinc-950/30 px-2 py-2 text-sm"
            value={helperCharacterId}
            onChange={(e) => patch({ helper_character_id: e.target.value || null })}
          >
            <option value="">— выбери персонажа —</option>
            {helpers.map((ch: any) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSubmit({ request_aid: false, helper_character_id: null, accept: null })}
          className="rounded border border-white10 px-3 py-2 text-sm text-white70 hover:bg-white/5"
        >
          Без помощи
        </button>
        {requestAid && (
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              onSubmit({
                request_aid: true,
                helper_character_id: helperCharacterId || null,
                accept: true,
              })
            }
            className={`rounded border px-3 py-2 text-sm font-semibold ${
              valid
                ? "border-emerald-400/70 text-emerald-200 hover:bg-emerald-500/10"
                : "border-white10 text-white30 cursor-not-allowed"
            }`}
          >
            Принять помощь (+1)
          </button>
        )}
      </div>
    </div>
  );
}