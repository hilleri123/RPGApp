export type NamePartKind = 'given' | 'family' | 'nickname' | 'full';

export type NameEntrySource = 'pack' | 'codex';

export type NameGeneratorEntry = {
  name: string;
  tags: string[];
  description?: string;
  part_kind?: NamePartKind;
  source?: NameEntrySource;
};

const ITEM_ONLY_TAGS = new Set([
  'item',
  'game_item',
  'weapon',
  'armor',
  'gear',
  'potion',
  'magic',
  'consumable',
  'travel',
  'camp',
  'jewelry',
  'sword',
  'hammer',
  'dagger',
  'bow',
  'shield',
]);

function entityKindTags(entityKind: 'npc' | 'character' | 'item' | 'game_item'): string[] {
  if (entityKind === 'game_item') return ['item', 'game_item'];
  if (entityKind === 'item') return ['item', 'game_item'];
  return [entityKind, 'npc', 'character'];
}

export function isNameEntryApplicable(
  entry: NameGeneratorEntry,
  entityKind: 'npc' | 'character' | 'item' | 'game_item',
): boolean {
  const kindTags = entityKindTags(entityKind);
  const tags = entry.tags ?? [];

  if (entityKind === 'item' || entityKind === 'game_item') {
    if (!tags.length) return entry.part_kind === 'full' || !entry.part_kind;
    return tags.some((t) => kindTags.includes(t));
  }

  // NPC / персонаж
  if (entry.source === 'pack' || tags.length === 0) {
    if (!tags.length) return true;
    if (tags.some((t) => kindTags.includes(t))) return true;
    if (!tags.some((t) => ITEM_ONLY_TAGS.has(t))) return true;
    return false;
  }

  if (tags.some((t) => kindTags.includes(t))) return true;
  return false;
}

function normalizeEntry(e: Record<string, unknown>): NameGeneratorEntry {
  const part = (e.part_kind as NamePartKind) || 'full';
  const sourceRaw = e.source;
  return {
    name: String(e.name ?? ''),
    tags: Array.isArray(e.tags) ? (e.tags as string[]) : [],
    description: e.description ? String(e.description) : undefined,
    part_kind: part,
    source: sourceRaw === 'pack' ? 'pack' : 'codex',
  };
}

export function mergeNameGeneratorEntryLists(...lists: NameGeneratorEntry[][]): NameGeneratorEntry[] {
  const seen = new Set<string>();
  const out: NameGeneratorEntry[] = [];
  for (const list of lists) {
    for (const e of list) {
      const key = `${entryPartKind(e)}:${e.name}:${e.source ?? 'codex'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
  }
  return out;
}

export function getNameGeneratorEntries(
  config: unknown,
  extraPackEntries: NameGeneratorEntry[] = [],
): NameGeneratorEntry[] {
  const c = config as Record<string, any> | null | undefined;
  const fromRoot = (c?.nameGenerators?.entries ?? []).map((e: Record<string, unknown>) => normalizeEntry(e));
  const fromPbta = (c?.pbta?.nameGenerators?.entries ?? []).map((e: Record<string, unknown>) =>
    normalizeEntry(e),
  );
  const extras = extraPackEntries.map((e) => ({ ...e, source: 'pack' as const }));
  return mergeNameGeneratorEntryLists(fromRoot, fromPbta, extras);
}

export type NicknameFormat = 'guillemets' | 'quotes' | 'dash';

export function composeDisplayName(opts: {
  given: string;
  family: string;
  nickname: string;
  includeFamily: boolean;
  includeNickname: boolean;
  familyBeforeGiven?: boolean;
  nicknameFormat?: NicknameFormat;
}): string {
  const g = opts.given.trim();
  const f = opts.includeFamily ? opts.family.trim() : '';
  const n = opts.includeNickname ? opts.nickname.trim() : '';
  const fmt = opts.nicknameFormat ?? 'guillemets';

  let core = g;
  if (f) {
    core = opts.familyBeforeGiven ? (g ? `${f} ${g}` : f) : g ? `${g} ${f}` : f;
  }

  if (!n) return core;

  if (fmt === 'quotes') return core ? `${core} "${n}"` : `"${n}"`;
  if (fmt === 'dash') return core ? `${core} — ${n}` : n;
  return core ? `${core} («${n}»)` : `«${n}»`;
}

export function entryPartKind(e: NameGeneratorEntry): NamePartKind {
  return e.part_kind ?? 'full';
}

export function filterEntriesByTags(
  entries: NameGeneratorEntry[],
  tagFilter: string[],
  mode: 'all' | 'any',
): NameGeneratorEntry[] {
  if (!tagFilter.length) return entries;
  if (mode === 'any') {
    return entries.filter((e) => tagFilter.some((t) => (e.tags ?? []).includes(t)));
  }
  return entries.filter((e) => tagFilter.every((t) => (e.tags ?? []).includes(t)));
}
