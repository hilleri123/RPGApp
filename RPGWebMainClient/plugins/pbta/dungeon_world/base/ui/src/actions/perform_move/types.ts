import type { ScenePayload } from '@/plugins/common/types/actionContext';
import type { ActionParticipants } from '@/plugins/common/types/actionContext';
import type { ActionIssue } from '@/plugins/common/types/actionRuntime';

export type UUID = string;

export type ActorKind = 'character' | 'npc';
export type TargetKind = 'character' | 'npc' | 'none';
export type OutcomeKind = 'hit_10_plus' | 'hit_7_9' | 'miss_6_minus';
export type TempBonusKind = 'forward' | 'ongoing';
export type GrantOn =
  | 'hit_10_plus'
  | 'hit_7_9'
  | 'hit_7_plus'
  | 'miss_6_minus'
  | 'any_hit'
  | 'manual';

export interface TempBonus {
  id: string;
  kind: TempBonusKind;
  amount: number;
  source_move_id: string;
  stat_ids: string[];
  move_ids: string[];
  tags: string[];
  damage_bonus: number;
  damage_bonus_dice: string;
  description: string;
  duration_hint: string;
  expires_after_scene: boolean;
}

export interface AidEntry {
  requested: boolean;
  helperUserId?: UUID | null;
  helperCharacterId?: UUID | null;
  accepted?: boolean | null;
  bonus_amount: number;
  note: string;
}

export interface GrantedBonus {
  targetKind: 'character' | 'npc';
  targetId: UUID;
  bonus: TempBonus;
}

export interface DamageEntry {
  sourceKind: 'character' | 'npc' | 'gm';
  sourceId?: UUID | null;
  targetKind: 'character' | 'npc';
  targetId: UUID;
  damage_expr: string;
  damage_seed: string;
  damage_rolls: number[];
  damage_modifier: number;
  armor_applied: number;
  damage_total: number;
  damage_text: string;
}

export interface PerformMoveEntry {
  actorUserId: UUID;
  actorKind: ActorKind;
  actorCharacterId?: UUID | null;
  actorNpcId?: UUID | null;
  targetKind: TargetKind;
  targetCharacterId?: UUID | null;
  targetNpcId?: UUID | null;
  moveId: string;
  moveTitle: string;
  statId: string;
  statValue: number;
  baseModifier: number;
  localBonus: number;
  aidBonus: number;
  tempBonusAppliedIds: string[];
  rollSeed: string;
  dice: number[];
  total: number;
  outcome?: OutcomeKind | null;
  resultText: string;
  aid: AidEntry;
  grantedBonuses: GrantedBonus[];
  damages: DamageEntry[];
}

export interface PerformMoveContext {
  sceneId: UUID;
  entry: PerformMoveEntry;
}

export type PerformMoveStageKey =
  | 'perform_move.setup'
  | 'perform_move.aid'
  | 'perform_move.aid_response'
  | 'perform_move.move_setup'
  | 'perform_move.roll'
  | 'perform_move.gm_bonuses'
  | 'perform_move.damage'
  | 'perform_move.result'
  | 'completed';

export interface PerformMoveWorkflow {
  actionKey: 'perform_move';
  stageKey: PerformMoveStageKey;
  stageData?: Record<string, unknown>;
  context: PerformMoveContext;
  status?: string;
  tags?: string[];
}

// Намеренно НЕ extends ActionRuntime —
// чтобы не тащить несовместимые ограничения workflow.context
export interface PerformMoveAction {
  id: UUID;
  actionKey: 'perform_move';
  can_close?: boolean;
  status?: string;
  tags?: string[];
  scene_id?: UUID;
  participants?: ActionParticipants;
  participantIds?: UUID[];
  workflow: PerformMoveWorkflow;
  issues?: ActionIssue[];
  lastError?: string | null;
  sessionPatch?: Record<string, unknown> | null;
  scene?: ScenePayload;
}

export function isPerformMoveAction(action: any): action is PerformMoveAction {
  return action?.actionKey === 'perform_move';
}