
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


export type MoveChoiceView = {
  id: string;
  prompt: string;
  options: string[];
};

export type MoveResolutionViewModel = {
  moveId: string | null;
  moveTitle: string;
  outcome: string | null;
  outcomeLabel: string;
  resultText: string | null;
  triggerText: string | null;
  statId: string | null;
  statValue: number | null;
  rollTotal: number | null;
  baseModifier: number | null;
  localBonus: number | null;
  aidBonus: number | null;
  dice: number[];
  rollSeed: string | null;

  summary: string | null;
  effect: string | null;
  effect10Plus: string | null;
  effect79: string | null;
  effect6Minus: string | null;
  choices: MoveChoiceView[];
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

  const asNum = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
    return null;
  };

  const dice = Array.isArray(roll?.dice) ? roll.dice.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n)) : [];
  const rawChoices = entry?.resolve?.pending_choices;
  const choices: MoveChoiceView[] = Array.isArray(rawChoices)
    ? rawChoices.map((choice: any) => ({
        id: String(choice?.id ?? ''),
        prompt: String(choice?.prompt ?? ''),
        options: Array.isArray(choice?.options)
          ? choice.options.map((opt: any) => String(opt?.label ?? opt?.id ?? '')).filter(Boolean)
          : [],
      })).filter((choice: MoveChoiceView) => choice.prompt || choice.options.length > 0)
    : [];

  return {
    moveId: moveId ? String(moveId) : null,
    moveTitle: String(moveTitle ?? '—'),
    outcome: outcome ? String(outcome) : null,
    outcomeLabel: outcomeLabel(outcome),
    resultText: resultText ? String(resultText) : null,
    triggerText: triggerText ? String(triggerText) : null,
    statId: statId ? String(statId) : null,
    statValue: asNum(roll?.stat_value ?? entry?.statValue ?? entry?.stat_value),
    rollTotal,
    baseModifier: asNum(roll?.base_modifier),
    localBonus: asNum(roll?.local_bonus),
    aidBonus: asNum(roll?.aid_bonus),
    dice,
    rollSeed: roll?.roll_seed ? String(roll.roll_seed) : null,

    summary: moveRec?.summary ? String(moveRec.summary) : null,
    effect: moveRec?.effect ? String(moveRec.effect) : null,
    effect10Plus: moveRec?.effect_10_plus ? String(moveRec.effect_10_plus) : null,
    effect79: moveRec?.effect_7_9 ? String(moveRec.effect_7_9) : null,
    effect6Minus: moveRec?.effect_6_minus ? String(moveRec.effect_6_minus) : null,
    choices,
  };
}
