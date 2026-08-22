// ─── types.ts ────────────────────────────────────────────────────────────────
import type { ScenePayload }       from "plugins/common/types/actionContext";
import type { ActionParticipants } from "plugins/common/types/actionContext";
import type { ActionIssue }        from "plugins/common/types/actionRuntime";

export type UUID         = string;
export type ActorKind    = "character" | "npc";
export type TargetKind   = "character" | "npc" | "none";
export type OutcomeKind  = "hit_10_plus" | "hit_7_9" | "miss_6_minus";

// ── SkillConfig (бэк: SkillConfig / entry.skills) ────────────────────────────
export interface SkillConfig {
  id:    string;
  title: string;
  color: string; // hex "#rrggbb"
}

// ── AidState ──────────────────────────────────────────────────────────────────
export interface AidState {
  requested:           boolean;
  helper_user_id?:     UUID | null;
  helper_character_id?: UUID | null;
  accepted?:           boolean | null;
  bonus_amount:        number;
  note:                string;
}

// ── MoveRef ───────────────────────────────────────────────────────────────────
export interface MoveRef {
  id:    string;
  title: string;
  kind:  string;
}

// ── RollState ─────────────────────────────────────────────────────────────────
export interface RollState {
  required:       boolean;
  stat_id:        string;
  stat_value:     number;
  base_modifier:  number;
  local_bonus:    number;
  aid_bonus:      number;
  temp_bonus_ids: string[];
  roll_seed:      string;
  dice:           number[];
  total:          number;
  outcome?:       OutcomeKind | null;
  result_text:    string;
}

// ── ChoiceOption ──────────────────────────────────────────────────────────────
export interface ChoiceOption {
  id:      string;
  label:   string;
  payload: Record<string, unknown>;
}

// ── PendingChoice ─────────────────────────────────────────────────────────────
export type PendingChoiceKind =
  | "player_choice"
  | "gm_choice"
  | "question_list"
  | "target_choice";

export interface PendingChoice {
  id:                  string;
  kind:                PendingChoiceKind;
  prompt:              string;
  choose:              number;
  options:             ChoiceOption[];
  resolved_option_ids: string[];
  resolved:            boolean;
}

// ── EffectRecord ──────────────────────────────────────────────────────────────
export interface EffectRecord {
  kind:    string;
  payload: Record<string, unknown>;
  applied: boolean;
  text:    string;
}

// ── ResolveState ──────────────────────────────────────────────────────────────
export interface ResourceDraft {
  id:           string;
  move_id?:     string;
  move_title?:  string;
  spec_id?:     string;
  amount?:      number;
  target_kind?: string;
  target_id?:   string;
  description?: string;
  confirmed?:   boolean;
  skipped?:     boolean;
}

export interface ResolveState {
  effects:          EffectRecord[];
  pending_choices:  PendingChoice[];
  resource_drafts?: ResourceDraft[];
  log_lines:        string[];
}

// ── PerformMoveEntry ──────────────────────────────────────────────────────────
export interface PerformMoveEntry {
  actor_user_id:        UUID;
  actor_kind:           ActorKind;
  actor_character_id?:  UUID | null;
  actor_npc_id?:        UUID | null;
  target_kind:          TargetKind;
  target_character_id?: UUID | null;
  target_npc_id?:       UUID | null;
  moves:                MoveRef[];
  roll:                 RollState;
  aid:                  AidState;
  resolve?:             ResolveState;
  /** @deprecated use resolve.pending_choices */
  pending_choices?:     PendingChoice[];
  /** @deprecated use resolve.effects */
  effects?:             EffectRecord[];
  /** @deprecated use resolve.log_lines */
  log_lines?:           string[];
  skills:               SkillConfig[];
}

// ── PerformMoveContext ────────────────────────────────────────────────────────
export interface PerformMoveContext {
  scene_id: UUID;
  entry:    PerformMoveEntry;
}

// ── Stage keys ────────────────────────────────────────────────────────────────
export type PerformMoveStageKey =
  | "perform_move.setup"
  | "perform_move.declare"
  | "perform_move.aid"
  | "perform_move.roll"
  | "perform_move.resolve"
  | "perform_move.choose"
  | "perform_move.apply"
  | "perform_move.result"
  | "completed";

// ── stageData для declare ─────────────────────────────────────────────────────
export interface DeclareStagData {
  moves: MoveLite[];
}

export interface PerformMoveWorkflow {
  actionKey: "perform_move";
  stageKey:  PerformMoveStageKey;
  stageData: DeclareStagData | null;
  context:   PerformMoveContext;
  status?:   string;
}

export interface PerformMoveAction {
  id:             UUID;
  actionKey:      "perform_move";
  canClose?:      boolean;
  status?:        string;
  participants?:  ActionParticipants;
  participantIds?: UUID[];
  workflow:       PerformMoveWorkflow;
  issues?:        ActionIssue[];
  lastError?:     string | null;
  sessionPatch?:  Record<string, unknown> | null;
  scene?:         ScenePayload;
  links?:         { characterToUserId?: Record<string, UUID> };
}

export function isPerformMoveAction(action: any): action is PerformMoveAction {
  return action?.actionKey === "perform_move";
}

// ── Утилиты ───────────────────────────────────────────────────────────────────
export function asStr(x: any, fb = ""): string {
  return String(x ?? "").trim() || fb;
}
export function asNum(x: any, fb = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fb;
}
export function asBool(x: any, fb = false): boolean {
  return typeof x === "boolean" ? x : fb;
}

export function getActorName(scene: any, entry: PerformMoveEntry): string {
  if (entry?.actor_character_id)
    return scene?.characters?.find((x: any) => String(x.id) === String(entry.actor_character_id))?.name ?? "";
  if (entry?.actor_npc_id)
    return scene?.npcs?.find((x: any) => String(x.id) === String(entry.actor_npc_id))?.name ?? "NPC";
  return "";
}

export function getTargetName(scene: any, entry: PerformMoveEntry): string {
  if (entry?.target_character_id)
    return scene?.characters?.find((x: any) => String(x.id) === String(entry.target_character_id))?.name ?? "";
  if (entry?.target_npc_id)
    return scene?.npcs?.find((x: any) => String(x.id) === String(entry.target_npc_id))?.name ?? "NPC";
  return "";
}

export function outcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return "";
  if (outcome === "hit_10_plus") return "10+";
  if (outcome === "hit_7_9")     return "7–9";
  if (outcome === "miss_6_minus") return "6−";
  return outcome;
}

export function outcomeColor(outcome: string | null | undefined): string {
  if (outcome === "hit_10_plus")  return "text-emerald-300";
  if (outcome === "hit_7_9")      return "text-amber-300";
  if (outcome === "miss_6_minus") return "text-rose-300";
  return "text-white/60";
}

// ── MoveLite (из stageData.moves) ─────────────────────────────────────────────
export interface MoveLite {
  id:              string;
  title:           string;
  kind?:           string;
  available_stats?: string[];
  summary?:        string;
  trigger?:        string;
  effect?:         string;
  effect_10_plus?: string;
  effect_7_9?:     string;
  effect_6_minus?: string;
  casts_spell?:    boolean;
}

export function entryResolve(entry: Partial<PerformMoveEntry> | null | undefined): ResolveState {
  const resolve = entry?.resolve;
  return {
    effects: resolve?.effects ?? entry?.effects ?? [],
    pending_choices: resolve?.pending_choices ?? entry?.pending_choices ?? [],
    resource_drafts: resolve?.resource_drafts ?? [],
    log_lines: resolve?.log_lines ?? entry?.log_lines ?? [],
  };
}

/** Primary declared move — backend stores `entry.moves[]`, not singular `entry.move`. */
export function primaryMoveRef(entry: Partial<PerformMoveEntry> | null | undefined): MoveRef | null {
  const moves = entry?.moves;
  if (Array.isArray(moves) && moves.length > 0 && moves[0]?.id) {
    return {
      id: String(moves[0].id),
      title: String(moves[0].title ?? ''),
      kind: String(moves[0].kind ?? ''),
    };
  }
  // Legacy singular shape (pre-moves[] refactor)
  const legacy = (entry as { move?: MoveRef } | null | undefined)?.move;
  if (legacy?.id) {
    return {
      id: String(legacy.id),
      title: String(legacy.title ?? ''),
      kind: String(legacy.kind ?? ''),
    };
  }
  return null;
}

export function parseMovesFromStageData(action: PerformMoveAction): MoveLite[] {
  const raw = action?.workflow?.stageData?.moves;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m: any): MoveLite | null => {
      if (!m || typeof m !== "object") return null;
      return {
        id:              String(m.id ?? ""),
        title:           String(m.title ?? ""),
        kind:            m.kind            != null ? String(m.kind)            : undefined,
        available_stats: Array.isArray(m.available_stats) ? m.available_stats.map(String) : [],
        summary:         m.summary         != null ? String(m.summary)         : undefined,
        trigger:         m.trigger         != null ? String(m.trigger)         : undefined,
        effect:          m.effect          != null ? String(m.effect)          : undefined,
        effect_10_plus:  m.effect_10_plus  != null ? String(m.effect_10_plus)  : undefined,
        effect_7_9:      m.effect_7_9      != null ? String(m.effect_7_9)      : undefined,
        effect_6_minus:  m.effect_6_minus  != null ? String(m.effect_6_minus)  : undefined,
        casts_spell:     Boolean(m.casts_spell),
      };
    })
    .filter((m): m is MoveLite => !!m && !!m.id);
}
