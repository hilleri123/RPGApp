import type { Move, MoveStatScore, PbtaSkill, Playbook } from '../types';

export function pbtaModifier(score: number): number {
  if (score <= 3)  return -3;
  if (score <= 5)  return -2;
  if (score <= 8)  return -1;
  if (score <= 12) return 0;
  if (score <= 15) return 1;
  if (score <= 17) return 2;
  return 3;
}

export function modStr(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function alpha(hex: string, a: number): string | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function statScoresForMove(
  move: Move,
  stats: Record<string, number>,
): MoveStatScore[] {
  return (move.available_stats ?? []).map((sid) => {
    const score = Number(stats[sid] ?? 10);
    return { sid, score, mod: pbtaModifier(score) };
  });
}

/** Ходы, которые показываются в блоке конкретного стата */
export function movesForStat(
  statId: string,
  playbook: Playbook | null,
  movesMap: Map<string, Move>,
  basicMoveIds: Set<string>,
): Move[] {
  if (!playbook) return [];
  const pool = new Set([
    ...playbook.starting_moves,
    ...playbook.advanced_moves,
    ...basicMoveIds,
  ]);
  return [...pool]
    .map((mid) => movesMap.get(mid))
    .filter((m): m is Move => !!m && (m.available_stats ?? []).includes(statId));
}

/** Совпадает ли текущий набор статов с шаблонным массивом */
export function matchStatArray(arr: number[], currentStatSet: number[]): boolean {
  const sorted = [...arr].sort((a, b) => b - a);
  return (
    sorted.length === currentStatSet.length &&
    sorted.every((v, i) => v === currentStatSet[i])
  );
}

export function computeCharacterStats(
  playbook: Playbook | null,
  stats: Record<string, number>,
): {
  maxHp: number;
  maxLoad: number;
  damageDie: string;
  conMod: number;
  conScore: number;
  strMod: number;
} {
  const conScore = Number(stats['con'] ?? 10);
  const conMod   = pbtaModifier(conScore);
  const strMod   = pbtaModifier(Number(stats['str'] ?? 10));
  const baseHp   = playbook?.base_hp   ?? 0;
  const baseLoad = playbook?.base_load ?? 10;
  return {
    maxHp:     baseHp + conScore,
    maxLoad:   baseLoad + strMod,
    damageDie: playbook?.damage_die ?? 'd6',
    conMod,
    conScore,
    strMod,
  };
}

export const DEFAULT_STAT_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'];