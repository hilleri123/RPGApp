// ─── stages/PerformMoveSetupStage.tsx ───────────────────────────────────────
// Бэк: pbta.perform_move.setup
// Input: actor_character_id | actor_npc_id, target_character_id?, target_npc_id?
"use client";
import React, { useEffect } from "react";
import { Sword } from "lucide-react";
import { getSceneBundle } from "plugins/common/types/actionSelectors";
import { asStr } from "../types";

type Props = {
  action: any;
  value: any;
  patch: (next: Record<string, unknown>) => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  setSubmitEnabled: (e: boolean) => void;
};

export function PerformMoveSetupStage({ action, value, patch, onSubmit, setSubmitEnabled }: Props) {
  const scene = getSceneBundle(action);
  const characters = scene?.scene?.characters ?? [];
  const npcs = scene?.scene?.npcs ?? [];

  const actorCharacterId = value?.actor_character_id ?? "";
  const actorNpcId = value?.actor_npc_id ?? "";
  const targetCharacterId = value?.target_character_id ?? "";
  const targetNpcId = value?.target_npc_id ?? "";

  // ровно один актор
  const valid = Boolean(actorCharacterId) !== Boolean(actorNpcId)
    ? Boolean(actorCharacterId) || Boolean(actorNpcId)
    : false;

  useEffect(() => { setSubmitEnabled(valid); }, [valid, setSubmitEnabled]);

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <div className="font-medium flex items-center gap-2">
        <Sword className="w-4 h-4 text-indigo-300" />
        Выбор актора и цели
      </div>

      {/* Актор */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded border border-white10 p-3 space-y-2">
          <div className="text-sm text-white70">Персонаж-актор</div>
          <select
            className="w-full rounded border bg-zinc-950/30 px-2 py-2 text-sm"
            value={actorCharacterId}
            onChange={(e) => patch({ actor_character_id: e.target.value || null, actor_npc_id: null })}
          >
            <option value="">—</option>
            {characters.map((ch: any) => (
              <option key={ch.id} value={ch.id}>{asStr(ch.name, ch.id)}</option>
            ))}
          </select>
        </div>
        <div className="rounded border border-white10 p-3 space-y-2">
          <div className="text-sm text-white70">NPC-актор</div>
          <select
            className="w-full rounded border bg-zinc-950/30 px-2 py-2 text-sm"
            value={actorNpcId}
            onChange={(e) => patch({ actor_npc_id: e.target.value || null, actor_character_id: null })}
          >
            <option value="">—</option>
            {npcs.map((npc: any) => (
              <option key={npc.id} value={npc.id}>{asStr(npc.name, "NPC")}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Цель (опционально) */}
      <div className="rounded border border-white10 p-3 space-y-2">
        <div className="text-sm text-white70">Цель (необязательно)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            className="w-full rounded border bg-zinc-950/30 px-2 py-2 text-sm"
            value={targetCharacterId}
            onChange={(e) => patch({ target_character_id: e.target.value || null, target_npc_id: null })}
          >
            <option value="">— персонаж —</option>
            {characters.map((ch: any) => (
              <option key={ch.id} value={ch.id}>{asStr(ch.name, ch.id)}</option>
            ))}
          </select>
          <select
            className="w-full rounded border bg-zinc-950/30 px-2 py-2 text-sm"
            value={targetNpcId}
            onChange={(e) => patch({ target_npc_id: e.target.value || null, target_character_id: null })}
          >
            <option value="">— NPC —</option>
            {npcs.map((npc: any) => (
              <option key={npc.id} value={npc.id}>{asStr(npc.name, "NPC")}</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-white40">Цель можно не указывать для нарративных ходов.</div>
      </div>

      <button
        type="button"
        disabled={!valid}
        onClick={() =>
          onSubmit({
            actor_character_id: actorCharacterId || null,
            actor_npc_id: actorNpcId || null,
            target_character_id: targetCharacterId || null,
            target_npc_id: targetNpcId || null,
          })
        }
        className={`rounded border px-3 py-2 text-sm font-semibold ${
          valid
            ? "border-indigo-400/70 text-indigo-200 hover:bg-indigo-500/10"
            : "border-white10 text-white30 cursor-not-allowed"
        }`}
      >
        Далее
      </button>
    </div>
  );
}