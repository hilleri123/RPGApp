/**
 * Виды местности локации. Хранятся обычным тегом `loc:<id>` в `tags` локации,
 * поэтому клонирование, запуск и все фильтры по тегам работают без изменений.
 * Таблица зеркалит RPGdata/app/constants/location_kinds.py.
 */

export const LOCATION_KIND_PREFIX = 'loc:';

export type LocationKind = { id: string; label: string; emoji: string };

export const LOCATION_KINDS: LocationKind[] = [
  { id: 'world', label: 'Мир', emoji: '🌍' },
  { id: 'continent', label: 'Континент', emoji: '🗺️' },
  { id: 'ocean', label: 'Море / океан', emoji: '🌊' },
  { id: 'island', label: 'Остров', emoji: '🏝️' },
  { id: 'country', label: 'Страна', emoji: '🏳️' },
  { id: 'region', label: 'Регион', emoji: '🧭' },
  { id: 'wilderness', label: 'Дикие земли', emoji: '🏜️' },
  { id: 'forest', label: 'Лес', emoji: '🌲' },
  { id: 'mountains', label: 'Горы', emoji: '⛰️' },
  { id: 'city', label: 'Город', emoji: '🏙️' },
  { id: 'village', label: 'Деревня', emoji: '🏘️' },
  { id: 'district', label: 'Район / квартал', emoji: '🏚️' },
  { id: 'street', label: 'Улица', emoji: '🛣️' },
  { id: 'building', label: 'Здание / дом', emoji: '🏠' },
  { id: 'apartment', label: 'Квартира', emoji: '🚪' },
  { id: 'room', label: 'Комната', emoji: '🛋️' },
  { id: 'tavern', label: 'Таверна / заведение', emoji: '🍺' },
  { id: 'dungeon', label: 'Подземелье', emoji: '🕳️' },
  { id: 'ship', label: 'Корабль / транспорт', emoji: '⛵' },
  { id: 'other', label: 'Другое', emoji: '📍' },
];

const BY_ID = new Map(LOCATION_KINDS.map((k) => [k.id, k]));

export const kindTag = (kindId: string): string => `${LOCATION_KIND_PREFIX}${kindId}`;

export const isKindTag = (tag: unknown): boolean =>
  typeof tag === 'string' && tag.startsWith(LOCATION_KIND_PREFIX);

/** Вид из списка тегов (первый известный) или null. */
export function kindOfTags(tags: readonly string[] | null | undefined): LocationKind | null {
  for (const t of tags ?? []) {
    if (isKindTag(t)) {
      const k = BY_ID.get(String(t).slice(LOCATION_KIND_PREFIX.length));
      if (k) return k;
    }
  }
  return null;
}

/** Тег без всех `loc:*` + (опционально) новый вид. Гарантирует «не более одного вида». */
export function withKind(tags: readonly string[] | null | undefined, kindId: string | null): string[] {
  const rest = (tags ?? []).filter((t) => !isKindTag(t));
  return kindId ? [...rest, kindTag(kindId)] : rest;
}

/** Человекочитаемая подпись тега для чипов; обычные теги возвращаются как есть. */
export function displayTagLabel(key: string): string {
  if (!isKindTag(key)) return key;
  const k = BY_ID.get(key.slice(LOCATION_KIND_PREFIX.length));
  return k ? `${k.emoji} ${k.label}` : key;
}
