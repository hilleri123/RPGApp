import type { Move, MovePlaceholder, MovePlaceholderOption, Playbook } from '../../types/pbta';

const TOKEN_RE = /\{\{(\w+)\}\}/g;

function pickValue(picks: Record<string, string> | undefined, placeholderId: string): string {
  return String(picks?.[placeholderId] ?? '').trim();
}

export function labelForPick(
  ph: MovePlaceholder,
  value: string,
  movesMap?: Map<string, Move> | Record<string, Move>,
): string {
  if (!value) return '';
  if (ph.kind === 'enum') {
    const opt = (ph.options ?? []).find((o) => o.id === value);
    return opt?.label ?? value;
  }
  if (ph.kind === 'move_pick' && movesMap) {
    const map = movesMap instanceof Map ? movesMap : new Map(Object.entries(movesMap));
    const move = map.get(value);
    if (move) return move.title;
  }
  return value;
}

export function resolveMoveField(
  text: string | undefined | null,
  placeholders: MovePlaceholder[] | undefined,
  picks: Record<string, string> | undefined,
  movesMap?: Map<string, Move> | Record<string, Move>,
): string {
  if (!text) return '';
  const phById = new Map((placeholders ?? []).map((ph) => [ph.id, ph]));

  return text.replace(TOKEN_RE, (_match, pid: string) => {
    const ph = phById.get(pid);
    const raw = pickValue(picks, pid);
    if (!raw) return `[${ph?.label ?? pid}]`;
    return ph ? labelForPick(ph, raw, movesMap) : raw;
  });
}

export function missingRequiredPlaceholders(
  placeholders: MovePlaceholder[] | undefined,
  picks: Record<string, string> | undefined,
): MovePlaceholder[] {
  return (placeholders ?? []).filter(
    (ph) => ph.required !== false && !pickValue(picks, ph.id),
  );
}

export function missingChoiceHint(missing: MovePlaceholder[]): string | null {
  if (!missing.length) return null;
  return `Выбор не задан: ${missing.map((ph) => ph.label).join(', ')}`;
}

export function optionsForMovePick(
  playbooks: Playbook[],
  movesMap: Map<string, Move>,
  playbookId: string,
  characterLevel: number,
  placeholder: MovePlaceholder,
): MovePlaceholderOption[] {
  const effectiveLevel = Math.max(1, characterLevel + (placeholder.level_delta ?? -1));
  const allowAdvanced = effectiveLevel >= 2;
  const allowMaster = effectiveLevel >= 6;
  const out: MovePlaceholderOption[] = [];

  for (const pb of playbooks) {
    if (!pb.id || pb.id === playbookId) continue;
    const moveIds = [...(pb.starting_moves ?? [])];
    if (allowAdvanced) moveIds.push(...(pb.advanced_moves ?? []));
    if (allowMaster) moveIds.push(...(pb.advanced_moves_6_10 ?? []));

    for (const mid of moveIds) {
      const move = movesMap.get(mid);
      if (!move) continue;
      out.push({ id: mid, label: `${pb.title}: ${move.title}` });
    }
  }

  out.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  return out;
}

export function getMovePicks(
  movePicks: Record<string, Record<string, string>> | undefined,
  moveId: string,
): Record<string, string> {
  return movePicks?.[moveId] ?? {};
}
