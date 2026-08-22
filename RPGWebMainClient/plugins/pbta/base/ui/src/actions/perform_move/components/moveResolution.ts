
function outcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return '—';
  if (outcome === 'hit_10_plus') return '10+';
  if (outcome === 'hit_7_9') return '7–9';
  if (outcome === 'miss_6_minus' || outcome === 'miss') return '6−';
  if (outcome === 'manual') return 'Вручную';
  return outcome;
}

function primaryMoveFromEntry(entry: any): { id?: string; title?: string } | null {
  const moves = entry?.moves;
  if (Array.isArray(moves) && moves[0]?.id) return moves[0];
  if (entry?.move?.id) return entry.move;
  return null;
}


export type MoveResolutionViewModel = {
  moveId: string | null;
  moveTitle: string;
  outcome: string | null;
  outcomeLabel: string;
  resultText: string | null;
  triggerText: string | null;
  statId: string | null;
  rollTotal: number | null;

  summary: string | null;
  effect: string | null;
  effect10Plus: string | null;
  effect79: string | null;
  effect6Minus: string | null;
};

export function extractMoveResolution(action: any): MoveResolutionViewModel {
  const wf = action?.workflow ?? {};
  const entry = wf?.context?.entry ?? {};
  const roll = entry?.roll && typeof entry.roll === 'object' ? entry.roll : {};
  const primary = primaryMoveFromEntry(entry);

  const moves = wf.stageData?.moves ?? [];

  const moveId =
    primary?.id ??
    entry?.moveId ??
    entry?.move_id ??
    null;

  const move =
    moves.find((m: any) => String(m?.id) === String(moveId)) ??
    primary ??
    null;

  const moveRec = move && typeof move === 'object' ? move as Record<string, any> : null;

  const moveTitle =
    primary?.title ??
    entry?.moveTitle ??
    entry?.move_title ??
    moveRec?.title ??
    '—';

  const triggerText =
    entry?.triggerText ??
    entry?.trigger_text ??
    moveRec?.trigger ??
    null;

  const outcome = roll?.outcome ?? entry?.outcome ?? null;

  const resultText =
    roll?.result_text ??
    entry?.resultText ??
    entry?.result_text ??
    entry?.resolved_text ??
    null;

  const statId =
    roll?.stat_id ??
    entry?.statId ??
    entry?.stat_id ??
    null;

  const rawRollTotal = roll?.total ?? entry?.rollTotal ?? entry?.roll_total;
  const rollTotal =
    typeof rawRollTotal === 'number'
      ? rawRollTotal
      : typeof rawRollTotal === 'string' && rawRollTotal.trim() !== '' && !Number.isNaN(Number(rawRollTotal))
        ? Number(rawRollTotal)
        : null;

  return {
    moveId: moveId ? String(moveId) : null,
    moveTitle: String(moveTitle ?? '—'),
    outcome: outcome ? String(outcome) : null,
    outcomeLabel: outcomeLabel(outcome),
    resultText: resultText ? String(resultText) : null,
    triggerText: triggerText ? String(triggerText) : null,
    statId: statId ? String(statId) : null,
    rollTotal,

    summary: moveRec?.summary ? String(moveRec.summary) : null,
    effect: moveRec?.effect ? String(moveRec.effect) : null,
    effect10Plus: moveRec?.effect_10_plus ? String(moveRec.effect_10_plus) : null,
    effect79: moveRec?.effect_7_9 ? String(moveRec.effect_7_9) : null,
    effect6Minus: moveRec?.effect_6_minus ? String(moveRec.effect_6_minus) : null,
  };
}
