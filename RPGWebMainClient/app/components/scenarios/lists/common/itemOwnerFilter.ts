import type { ItemOwnerShort } from '@/app/services/types2';

/** '' = all, '__free__' = no owner, else `${type}:${id}` */
export type ItemOwnerFilterValue = string;

export function itemOwnerFilterKey(owner?: ItemOwnerShort | null): string {
  if (!owner?.id) return '__free__';
  return `${owner.type}:${owner.id}`;
}

export function itemOwnerFilterLabel(owner?: ItemOwnerShort | null): string {
  if (!owner?.id) return 'Свободен';
  const t =
    owner.type === 'npc' ? 'NPC' : owner.type === 'character' ? 'Персонаж' : 'Предмет';
  return `${t}: ${owner.name}`;
}

export type ItemOwnerOption = { value: string; label: string };

/** Unique owners present in a list, sorted by label. Always includes free if any free items. */
export function collectItemOwnerOptions(
  items: Array<{ owner?: ItemOwnerShort | null }>,
): ItemOwnerOption[] {
  const seen = new Map<string, string>();
  let hasFree = false;
  for (const it of items) {
    const key = itemOwnerFilterKey(it.owner);
    if (key === '__free__') {
      hasFree = true;
      continue;
    }
    if (!seen.has(key)) seen.set(key, itemOwnerFilterLabel(it.owner));
  }
  const owned = Array.from(seen.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  return hasFree ? [{ value: '__free__', label: 'Свободен' }, ...owned] : owned;
}

export function matchItemOwnerFilter(
  owner: ItemOwnerShort | null | undefined,
  filter: ItemOwnerFilterValue,
): boolean {
  if (!filter) return true;
  return itemOwnerFilterKey(owner) === filter;
}
