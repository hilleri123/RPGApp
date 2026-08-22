import type { EntityPack } from '@/app/services/api/entityPacks';

export const DEFAULT_PACK_TAG = 'default';

export function isDefaultPack(pack: Pick<EntityPack, 'tags'>): boolean {
  return (pack.tags ?? []).includes(DEFAULT_PACK_TAG);
}

export function formatPackTagLabel(tag: string): string {
  if (tag === DEFAULT_PACK_TAG) return 'по умолчанию';
  return tag;
}
