/**
 * Виды локаций. Хранятся обычным тегом `loc:<id>` в `tags` локации,
 * поэтому клонирование, запуск и все фильтры по тегам работают без изменений.
 * Таблица зеркалит RPGdata/app/constants/location_kinds.py.
 *
 * Иерархия (кто внутри кого):
 *
 *   Мир
 *   └─ Регион
 *      ├─ Город / поселение ─┬─ Район / улица ── Здание ─┬─ Комната
 *      │                     ├─ Здание                   └─ Подземелье ── Комната
 *      │                     └─ Подземелье
 *      ├─ Дикие земли ── Город / Здание / Подземелье
 *      └─ Подземелье
 */

export const LOCATION_KIND_PREFIX = 'loc:';

export type LocationKind = { id: string; label: string; emoji: string; level: number };

/** От крупного к мелкому; `level` — глубина для лесенки в редакторе. */
export const LOCATION_KINDS: LocationKind[] = [
  { id: 'world', label: 'Мир', emoji: '🌍', level: 0 },
  { id: 'region', label: 'Регион', emoji: '🧭', level: 1 },
  { id: 'city', label: 'Город / поселение', emoji: '🏙️', level: 2 },
  { id: 'wilds', label: 'Дикие земли', emoji: '🌲', level: 2 },
  { id: 'dungeon', label: 'Подземелье', emoji: '🕳️', level: 2 },
  { id: 'district', label: 'Район / улица', emoji: '🛣️', level: 3 },
  { id: 'building', label: 'Здание', emoji: '🏠', level: 4 },
  { id: 'room', label: 'Комната', emoji: '🚪', level: 5 },
];

/**
 * Прямые потомки в иерархии (само дерево). Внутри локации допустим любой потомок —
 * дети, внуки, правнуки и т.д. (см. allowedChildKinds): комната может лежать прямо в городе.
 */
export const LOCATION_KIND_CHILDREN: Record<string, string[]> = {
  world: ['region'],
  region: ['city', 'wilds', 'dungeon'],
  city: ['district', 'building', 'dungeon'],
  wilds: ['city', 'building', 'dungeon'],
  dungeon: ['room'],
  district: ['building'],
  building: ['room', 'dungeon'],
  room: [],
};

/** Старые виды (до сокращения иерархии) → текущие; null = вид убран. */
const LEGACY_KIND_ALIASES: Record<string, string | null> = {
  continent: 'region',
  ocean: 'region',
  island: 'region',
  country: 'region',
  wilderness: 'wilds',
  forest: 'wilds',
  mountains: 'wilds',
  village: 'city',
  street: 'district',
  tavern: 'building',
  ship: 'building',
  apartment: 'room',
  other: null,
};

const BY_ID = new Map(LOCATION_KINDS.map((k) => [k.id, k]));

/** Текущий id вида для id (в т.ч. старого); null, если вида нет. */
export function canonicalKindId(id: string | null | undefined): string | null {
  if (!id) return null;
  if (BY_ID.has(id)) return id;
  return LEGACY_KIND_ALIASES[id] ?? null;
}

export const kindTag = (kindId: string): string => `${LOCATION_KIND_PREFIX}${kindId}`;

export const isKindTag = (tag: unknown): boolean =>
  typeof tag === 'string' && tag.startsWith(LOCATION_KIND_PREFIX);

export const kindById = (id: string | null | undefined): LocationKind | null => {
  const c = canonicalKindId(id);
  return c ? BY_ID.get(c) ?? null : null;
};

/** Вид из списка тегов (первый известный) или null. */
export function kindOfTags(tags: readonly string[] | null | undefined): LocationKind | null {
  for (const t of tags ?? []) {
    if (isKindTag(t)) {
      const k = kindById(String(t).slice(LOCATION_KIND_PREFIX.length));
      if (k) return k;
    }
  }
  return null;
}

/** Тег без всех `loc:*` + (опционально) новый вид. Гарантирует «не более одного вида». */
export function withKind(tags: readonly string[] | null | undefined, kindId: string | null): string[] {
  const rest = (tags ?? []).filter((t) => !isKindTag(t));
  const c = canonicalKindId(kindId);
  return c ? [...rest, kindTag(c)] : rest;
}

/** Человекочитаемая подпись тега для чипов; обычные теги возвращаются как есть. */
export function displayTagLabel(key: string): string {
  if (!isKindTag(key)) return key;
  const k = kindById(key.slice(LOCATION_KIND_PREFIX.length));
  return k ? `${k.emoji} ${k.label}` : key;
}

/** Все потомки вида: дети, внуки, правнуки... */
export function descendantKindIds(kindId: string | null | undefined, seen: Set<string> = new Set()): Set<string> {
  const out = new Set<string>();
  const id = canonicalKindId(kindId);
  if (!id || seen.has(id)) return out;
  const nextSeen = new Set(seen).add(id);
  for (const child of LOCATION_KIND_CHILDREN[id] ?? []) {
    out.add(child);
    for (const d of descendantKindIds(child, nextSeen)) out.add(d);
  }
  return out;
}

/** Виды, допустимые внутри локации с указанным видом — на любой глубине (null — любые). */
export function allowedChildKinds(parentKindId: string | null | undefined): LocationKind[] {
  const parent = canonicalKindId(parentKindId);
  if (!parent) return LOCATION_KINDS;
  const set = descendantKindIds(parent);
  return LOCATION_KINDS.filter((k) => set.has(k.id));
}

export const isKindAllowedUnder = (parentKindId: string | null | undefined, kindId: string): boolean => {
  const c = canonicalKindId(kindId);
  return c != null && allowedChildKinds(parentKindId).some((k) => k.id === c);
};
