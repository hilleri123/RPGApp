import type { SceneMode } from './sceneModes';
import { MODE_LABEL } from './sceneModes';

export type MoveContextTag = SceneMode | 'action_camp' | 'action_travel' | 'universal' | 'special';

export function moveContextKey(requires_context?: string[] | null): MoveContextTag {
  const ctx = (requires_context ?? []).map((t) => String(t).toLowerCase());
  if (!ctx.length) return 'special';
  const hasAction = ctx.includes('action');
  const hasCamp = ctx.includes('camp');
  const hasTravel = ctx.includes('travel');
  if (hasAction && hasCamp && hasTravel) return 'universal';
  if (hasAction && hasCamp) return 'action_camp';
  if (hasAction && hasTravel) return 'action_travel';
  if (hasCamp && hasTravel) return 'travel';
  if (hasCamp) return 'camp';
  if (hasTravel) return 'travel';
  if (hasAction) return 'action';
  return 'special';
}

export const CONTEXT_GROUP_LABEL: Record<MoveContextTag, string> = {
  action: 'Действие',
  camp: 'Лагерь',
  travel: 'Путешествие',
  action_camp: 'Действие и лагерь',
  action_travel: 'Действие и путешествие',
  universal: 'Любая сцена',
  special: 'Особые ходы',
};

export const CONTEXT_GROUP_ORDER: MoveContextTag[] = [
  'action',
  'camp',
  'travel',
  'action_camp',
  'action_travel',
  'universal',
  'special',
];

export function sceneModeLabelFromTags(tags?: string[] | null): string | null {
  if (!tags?.length) return null;
  const mode = tags.find((t) => ['action', 'camp', 'travel'].includes(String(t)));
  return mode ? MODE_LABEL[mode as SceneMode] ?? mode : null;
}
