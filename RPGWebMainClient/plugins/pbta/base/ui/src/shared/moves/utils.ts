import type { MoveDisplayData } from './types';
import { alpha } from '../../lib/pbta';

export function toMoveDisplayData(move: {
  id: string;
  title: string;
  kind?: string;
  summary?: string | null;
  trigger?: string | null;
  effect?: string | null;
  effect_10_plus?: string | null;
  effect_7_9?: string | null;
  effect_6_minus?: string | null;
  available_stats?: string[] | null;
}): MoveDisplayData {
  return {
    id: String(move.id),
    title: String(move.title),
    kind: move.kind != null ? String(move.kind) : undefined,
    summary: move.summary ?? undefined,
    trigger: move.trigger ?? undefined,
    effect: move.effect ?? undefined,
    effect_10_plus: move.effect_10_plus ?? undefined,
    effect_7_9: move.effect_7_9 ?? undefined,
    effect_6_minus: move.effect_6_minus ?? undefined,
    available_stats: Array.isArray(move.available_stats) ? move.available_stats.map(String) : [],
  };
}

export function moveKindLabel(move: MoveDisplayData, playbookTitle?: string | null): string {
  if (move.kind === 'basic') return 'Базовый ход';
  if (move.kind === 'advanced') return playbookTitle ? `Продвинутый: ${playbookTitle}` : 'Продвинутый ход';
  if (move.kind === 'special') return 'Особый ход';
  if (move.kind === 'gm') return 'Ход ведущего';
  return playbookTitle ? `Ход класса: ${playbookTitle}` : 'Ход класса';
}

export function statChipStyle(skills: { id: string; color?: string }[] | undefined, statId: string | undefined) {
  if (!statId || !skills?.length) return {};
  const skill = skills.find((s) => s.id === statId);
  if (!skill?.color) return {};
  return {
    borderColor: alpha(skill.color, 0.7) ?? '#4b5563',
    backgroundColor: alpha(skill.color, 0.15) ?? 'rgba(0,0,0,0.4)',
  };
}

export function outcomeLabel(outcome?: string | null): string | null {
  if (outcome === 'hit_10_plus') return '10+';
  if (outcome === 'hit_7_9') return '7–9';
  if (outcome === 'miss_6_minus') return '6−';
  return null;
}

export function outcomeAccent(outcome?: string | null): string {
  if (outcome === 'hit_10_plus') return 'text-emerald-300';
  if (outcome === 'hit_7_9') return 'text-amber-300';
  if (outcome === 'miss_6_minus') return 'text-rose-300';
  return 'text-gray-500';
}
