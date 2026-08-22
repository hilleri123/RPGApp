import type { Move, MoveTextOverride } from '../types/pbta';

const TEXT_FIELDS = [
  'title',
  'summary',
  'trigger',
  'effect',
  'effect_10_plus',
  'effect_7_9',
  'effect_6_minus',
] as const;

export function hasMoveTextOverride(ov: MoveTextOverride | undefined | null): boolean {
  if (!ov) return false;
  return TEXT_FIELDS.some((f) => String(ov[f] ?? '').trim().length > 0);
}

export function applyMoveTextOverride(base: Move, ov: MoveTextOverride | undefined): Move {
  if (!ov || !hasMoveTextOverride(ov)) return base;
  const next: Move = { ...base };
  for (const f of TEXT_FIELDS) {
    const val = ov[f];
    if (val != null && String(val).length > 0) {
      (next as Record<string, unknown>)[f] = val;
    }
  }
  return next;
}

export function effectiveMove(
  base: Move | undefined,
  overrides: Record<string, MoveTextOverride> | undefined,
  moveId: string,
): Move | undefined {
  if (!base) return undefined;
  return applyMoveTextOverride(base, overrides?.[moveId]);
}

export function emptyMoveTextOverride(): MoveTextOverride {
  return {
    title: '',
    summary: '',
    trigger: '',
    effect: '',
    effect_10_plus: '',
    effect_7_9: '',
    effect_6_minus: '',
  };
}

/** Snapshot codex move into override (for first edit). */
export function codexToMoveOverride(base: Move): MoveTextOverride {
  return {
    title: base.title ?? '',
    summary: base.summary ?? '',
    trigger: base.trigger ?? '',
    effect: base.effect ?? '',
    effect_10_plus: base.effect_10_plus ?? '',
    effect_7_9: base.effect_7_9 ?? '',
    effect_6_minus: base.effect_6_minus ?? '',
  };
}

export function patchMoveOverride(
  overrides: Record<string, MoveTextOverride> | undefined,
  moveId: string,
  patch: Partial<MoveTextOverride>,
): Record<string, MoveTextOverride> {
  const root = { ...(overrides ?? {}) };
  const prev = root[moveId] ?? emptyMoveTextOverride();
  root[moveId] = { ...prev, ...patch };
  return root;
}
