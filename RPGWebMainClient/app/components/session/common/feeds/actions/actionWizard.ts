import type { SessionAction } from '@/app/services/types/session';

export type WizardStep = {
  key: string;
  label: string;
  status: 'pending' | 'current' | 'done';
  readonly?: boolean;
  disabled?: boolean;
  frozen?: boolean;
  editable?: boolean;
};

export type ActionWizardState = {
  steps?: WizardStep[];
  currentKey?: string;
  furthestKey?: string;
  frozenThrough?: string | null;
  rollFrozen?: boolean;
};

export function readActionWizard(action: SessionAction | null | undefined): ActionWizardState | null {
  const wizard = (action?.workflow?.stageData as { wizard?: ActionWizardState } | undefined)?.wizard;
  if (!wizard) return null;
  if (wizard.steps?.length) return wizard;
  if (wizard.currentKey) return wizard;
  return null;
}

/** UI stage key: wizard sub-step, not server phase keys like perform_move.pre_roll. */
export function resolveActionViewKey(action: SessionAction | null | undefined): string {
  const stageKey = String(action?.workflow?.stageKey ?? '');
  const wizard = readActionWizard(action);
  if (wizard?.currentKey) return wizard.currentKey;
  if (stageKey === 'perform_move.pre_roll') return 'perform_move.declare';
  if (stageKey === 'perform_move.post_roll') return 'perform_move.change_manifest';
  return stageKey;
}

export function readStageDraft(action: SessionAction | null, stageKey: string): Record<string, unknown> {
  const sd = action?.workflow?.stageData as Record<string, unknown> | undefined;
  const stages = (sd?.stages ?? sd?.drafts) as Record<string, Record<string, unknown>> | undefined;
  if (stages?.[stageKey] && typeof stages[stageKey] === 'object') {
    return { ...stages[stageKey] };
  }
  if (stageKey === 'perform_move.declare' && sd?.draft && typeof sd.draft === 'object') {
    return { ...(sd.draft as Record<string, unknown>) };
  }
  return {};
}

export function isWizardStepReadonly(wizard: ActionWizardState | null | undefined, viewKey: string): boolean {
  const step = wizard?.steps?.find((s) => s.key === viewKey);
  if (!step) return false;
  // Active step is never "not yet arrived" — ignore stale disabled flags.
  if (String(wizard?.currentKey ?? '') === String(viewKey)) {
    return !!step.frozen;
  }
  return !!step.readonly || !!step.disabled;
}

export function isWizardStepEditable(wizard: ActionWizardState | null | undefined, viewKey: string): boolean {
  const step = wizard?.steps?.find((s) => s.key === viewKey);
  if (!step) return true;
  // Current step is editable unless frozen after the roll was committed.
  if (String(wizard?.currentKey ?? '') === String(viewKey)) {
    return !step.frozen;
  }
  return !!step.editable;
}

/** Empty `dice: []` is truthy in JS — only non-empty dice count as a committed roll. */
function hasCommittedDice(dice: unknown): boolean {
  return Array.isArray(dice) && dice.length > 0;
}

/** True once dice were committed or session effects applied — initiator may no longer cancel. */
export function isActionCancelLocked(action: SessionAction | null | undefined): boolean {
  if (!action) return true;
  if (action.status === 'completed' || action.status === 'canceled') return true;
  if (action.sessionPatch && Object.keys(action.sessionPatch).length > 0) return true;

  const ctx = action.workflow?.context;
  const entry = (ctx && typeof ctx === 'object' ? (ctx as { entry?: Record<string, unknown> }).entry : undefined) ?? {};
  const roll = (entry.roll && typeof entry.roll === 'object' ? entry.roll : {}) as Record<string, unknown>;
  // Defaults on fresh perform_move are dice:[], total:0 — must not lock.
  if (hasCommittedDice(roll.dice) || (roll.outcome != null && roll.outcome !== '') || (typeof roll.total === 'number' && roll.total !== 0)) {
    return true;
  }
  if (roll.roll_seed && (roll.result_text || hasCommittedDice(roll.dice))) return true;

  const claims = Array.isArray(entry.damage_claims) ? entry.damage_claims : [];
  for (const claim of claims) {
    if (claim && typeof claim === 'object' && (claim as { rolled?: boolean }).rolled) return true;
  }

  const sd = action.workflow?.stageData;
  if (sd && typeof sd === 'object') {
    for (const value of Object.values(sd)) {
      if (!value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>;
      if (hasCommittedDice(v.dice) && v.roll_seed) return true;
    }
  }

  return false;
}

export function canUserCancelAction(
  action: SessionAction | null | undefined,
  userId: string | undefined,
  isMaster: boolean,
): boolean {
  if (!action || !userId) return false;
  if (action.status === 'canceled') return false;
  if (isMaster) return true;
  if (String(action.participants?.initiatorUserId ?? '') !== String(userId)) return false;
  return !isActionCancelLocked(action);
}
