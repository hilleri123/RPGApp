'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dices, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  composeDisplayName,
  entryPartKind,
  filterEntriesByTags,
  isNameEntryApplicable,
  type NameGeneratorEntry,
  type NamePartKind,
  type NicknameFormat,
} from '@/app/components/scenarios/dialogs/common/nameGenerators';

export type { NameGeneratorEntry, NamePartKind };

type Props = {
  entries?: NameGeneratorEntry[];
  entityKind: 'npc' | 'character' | 'item' | 'game_item';
  /** Applied name + tags from the chosen name-pack/codex entries (caller filters to scenario pool). */
  onSelect: (result: { name: string; tags: string[] }) => void;
  disabled?: boolean;
  /** @deprecated use onSelect({name, tags}) */
  onSelectName?: (name: string) => void;
};

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function pickRandomMany<T>(items: T[], count: number): T[] {
  if (!items.length) return [];
  const pool = [...items];
  const out: T[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i += 1) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

const PART_LABELS: Record<NamePartKind, string> = {
  given: 'Имя',
  family: 'Фамилия',
  nickname: 'Прозвище',
  full: 'Целиком',
};

export function RandomNamePicker({ entries = [], entityKind, onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<'all' | 'any'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'pack' | 'codex'>('all');
  const [batch, setBatch] = useState<NameGeneratorEntry[]>([]);
  const [mode, setMode] = useState<'compose' | 'full'>('compose');
  const [expandedPart, setExpandedPart] = useState<NamePartKind | null>(null);

  const [given, setGiven] = useState('');
  const [family, setFamily] = useState('');
  const [nickname, setNickname] = useState('');
  const [givenTags, setGivenTags] = useState<string[]>([]);
  const [familyTags, setFamilyTags] = useState<string[]>([]);
  const [nicknameTags, setNicknameTags] = useState<string[]>([]);
  const [includeFamily, setIncludeFamily] = useState(true);
  const [includeNickname, setIncludeNickname] = useState(false);
  const [familyBeforeGiven, setFamilyBeforeGiven] = useState(false);
  const [nicknameFormat, setNicknameFormat] = useState<NicknameFormat>('guillemets');
  const [requireGiven, setRequireGiven] = useState(true);

  const emit = (name: string, tags: string[]) => {
    const uniq = Array.from(new Set(tags.map(String).filter(Boolean)));
    onSelect({ name, tags: uniq });
  };

  const composedTags = useMemo(() => {
    const out = [...givenTags];
    if (includeFamily) out.push(...familyTags);
    if (includeNickname) out.push(...nicknameTags);
    return out;
  }, [givenTags, familyTags, nicknameTags, includeFamily, includeNickname]);

  const applicable = useMemo(() => {
    return entries.filter((e) => {
      if (sourceFilter === 'pack' && e.source !== 'pack') return false;
      if (sourceFilter === 'codex' && e.source === 'pack') return false;
      return isNameEntryApplicable(e, entityKind);
    });
  }, [entries, entityKind, sourceFilter]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const e of applicable) {
      for (const t of e.tags ?? []) s.add(t);
    }
    return Array.from(s).sort();
  }, [applicable]);

  const filtered = useMemo(() => {
    return filterEntriesByTags(applicable, tagFilter, tagMatchMode);
  }, [applicable, tagFilter, tagMatchMode]);

  const byPart = useMemo(() => {
    const map: Record<NamePartKind, NameGeneratorEntry[]> = {
      given: [],
      family: [],
      nickname: [],
      full: [],
    };
    for (const e of filtered) {
      map[entryPartKind(e)].push(e);
    }
    return map;
  }, [filtered]);

  const packCount = useMemo(() => applicable.filter((e) => e.source === 'pack').length, [applicable]);
  const codexCount = applicable.length - packCount;

  const canCompose =
    entityKind === 'npc' || entityKind === 'character'
      ? byPart.given.length + byPart.family.length + byPart.nickname.length > 0
      : false;

  const preview = composeDisplayName({
    given,
    family,
    nickname,
    includeFamily,
    includeNickname,
    familyBeforeGiven,
    nicknameFormat,
  });

  const canApply =
    preview.trim().length > 0 && (!requireGiven || given.trim().length > 0 || !canCompose);

  const toggleTag = (tag: string) => {
    setTagFilter((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    setBatch([]);
  };

  const rollPart = (part: NamePartKind) => {
    const row = pickRandom(byPart[part]);
    if (!row) return;
    const tags = row.tags ?? [];
    if (part === 'given') {
      setGiven(row.name);
      setGivenTags(tags);
    }
    if (part === 'family') {
      setFamily(row.name);
      setFamilyTags(tags);
    }
    if (part === 'nickname') {
      setNickname(row.name);
      setNicknameTags(tags);
    }
  };

  const rollAllParts = () => {
    rollPart('given');
    if (includeFamily) rollPart('family');
    if (includeNickname) rollPart('nickname');
  };

  const generateFull = (count: number) => {
    setBatch(pickRandomMany(byPart.full, count));
  };

  if (!applicable.length) return null;

  const showCompose = canCompose && mode === 'compose';
  const showFullList = byPart.full.length > 0 && (!canCompose || mode === 'full');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="secondary" disabled={disabled} className="gap-1">
          <Sparkles className="w-4 h-4" />
          Имя
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,92vw)] p-3 space-y-3 max-h-[min(32rem,85vh)] overflow-y-auto" align="start">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">Имена</div>
          {canCompose && byPart.full.length > 0 ? (
            <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
              <button
                type="button"
                className={cn('px-2 py-0.5', mode === 'compose' ? 'bg-muted' : 'text-muted-foreground')}
                onClick={() => setMode('compose')}
              >
                Сборка
              </button>
              <button
                type="button"
                className={cn('px-2 py-0.5', mode === 'full' ? 'bg-muted' : 'text-muted-foreground')}
                onClick={() => setMode('full')}
              >
                Готовые
              </button>
            </div>
          ) : null}
        </div>

        <p className="text-[10px] text-muted-foreground leading-snug">
          В пуле: {applicable.length} записей
          {packCount > 0 ? ` · паки ${packCount}` : ''}
          {codexCount > 0 ? ` · codex ${codexCount}` : ''}
        </p>

        <div className="flex flex-wrap gap-1 text-[10px]">
          <span className="text-muted-foreground self-center mr-1">Источник:</span>
          {(
            [
              ['all', 'Все'],
              ['pack', 'Паки'],
              ['codex', 'Codex'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSourceFilter(key)}
              className={cn(
                'px-2 py-0.5 rounded-md border',
                sourceFilter === key ? 'border-violet-500/50 bg-violet-500/10' : 'border-border text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {allTags.length > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">Теги</div>
              <button
                type="button"
                className="text-[10px] text-sky-400 hover:underline"
                onClick={() => setTagMatchMode((m) => (m === 'all' ? 'any' : 'all'))}
              >
                {tagMatchMode === 'all' ? 'Все выбранные' : 'Любой из выбранных'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[11px] border',
                    tagFilter.includes(tag)
                      ? 'border-sky-500/50 bg-sky-500/15 text-sky-100'
                      : 'border-border text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
            {tagFilter.length > 0 ? (
              <button type="button" className="text-[10px] text-muted-foreground hover:underline" onClick={() => setTagFilter([])}>
                Сбросить фильтр
              </button>
            ) : null}
          </div>
        ) : null}

        {showCompose ? (
          <div className="space-y-2 rounded-lg border border-border/60 p-2">
            {(['given', 'family', 'nickname'] as const).map((part) => {
              if (part === 'family' && !includeFamily) return null;
              if (part === 'nickname' && !includeNickname) return null;
              const value = part === 'given' ? given : part === 'family' ? family : nickname;
              const pool = byPart[part];
              const expanded = expandedPart === part;
              return (
                <div key={part} className="space-y-1">
                  <div className="flex gap-1 items-center">
                    <span className="text-[11px] text-muted-foreground w-16 shrink-0">
                      {PART_LABELS[part]}
                      <span className="text-[10px] text-gray-500 ml-0.5">({pool.length})</span>
                    </span>
                    <InputLike value={value} onChange={(v) => {
                      if (part === 'given') setGiven(v);
                      if (part === 'family') setFamily(v);
                      if (part === 'nickname') setNickname(v);
                    }} />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      disabled={!pool.length}
                      onClick={() => rollPart(part)}
                      title={`Случайное: ${PART_LABELS[part]}`}
                    >
                      <Dices className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-1.5 text-[10px] shrink-0"
                      disabled={!pool.length}
                      onClick={() => setExpandedPart(expanded ? null : part)}
                    >
                      {expanded ? '▲' : '▼'}
                    </Button>
                  </div>
                  {expanded && pool.length > 0 ? (
                    <div className="ml-16 max-h-28 overflow-y-auto rounded border border-border/50 divide-y divide-border/30">
                      {pool.slice(0, 40).map((row) => (
                        <button
                          key={`${part}-${row.name}-${row.description}`}
                          type="button"
                          className="w-full text-left px-2 py-1 text-xs hover:bg-muted/50 truncate"
                          onClick={() => {
                            if (part === 'given') {
                              setGiven(row.name);
                              setGivenTags(row.tags ?? []);
                            }
                            if (part === 'family') {
                              setFamily(row.name);
                              setFamilyTags(row.tags ?? []);
                            }
                            if (part === 'nickname') {
                              setNickname(row.name);
                              setNicknameTags(row.tags ?? []);
                            }
                            setExpandedPart(null);
                          }}
                        >
                          {row.name}
                          {row.source === 'pack' ? (
                            <span className="text-[9px] text-violet-400 ml-1">пак</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs pt-1">
              <label className="flex items-center gap-1.5">
                <Checkbox checked={includeFamily} onCheckedChange={(v) => setIncludeFamily(v === true)} />
                Фамилия
              </label>
              <label className="flex items-center gap-1.5">
                <Checkbox checked={includeNickname} onCheckedChange={(v) => setIncludeNickname(v === true)} />
                Прозвище
              </label>
              <label className="flex items-center gap-1.5">
                <Checkbox checked={familyBeforeGiven} onCheckedChange={(v) => setFamilyBeforeGiven(v === true)} />
                Фамилия первая
              </label>
              <label className="flex items-center gap-1.5">
                <Checkbox checked={requireGiven} onCheckedChange={(v) => setRequireGiven(v === true)} />
                Нужно имя
              </label>
            </div>

            <div className="flex flex-wrap gap-2 items-center text-[11px]">
              <span className="text-muted-foreground">Прозвище:</span>
              <select
                className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px]"
                value={nicknameFormat}
                onChange={(e) => setNicknameFormat(e.target.value as NicknameFormat)}
              >
                <option value="guillemets">«кавычки»</option>
                <option value="quotes">"лапки"</option>
                <option value="dash">— тире</option>
              </select>
            </div>

            <div className="text-xs text-muted-foreground">Превью</div>
            <div className="text-sm font-medium min-h-[1.25rem] break-words">{preview || '—'}</div>

            <div className="flex gap-2 pt-1 flex-wrap">
              <Button type="button" size="sm" variant="outline" onClick={rollAllParts} disabled={!byPart.given.length && requireGiven}>
                Всё 🎲
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canApply}
                onClick={() => {
                  emit(preview.trim(), composedTags);
                  setOpen(false);
                }}
              >
                Применить
              </Button>
            </div>
          </div>
        ) : null}

        {showFullList ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => generateFull(5)} disabled={!byPart.full.length}>
                5 вариантов
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => generateFull(10)} disabled={!byPart.full.length}>
                10 вариантов
              </Button>
            </div>
            {batch.length === 0 ? (
              <p className="text-xs text-muted-foreground">Готовые строки из codex и паков (тип «целиком»).</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {batch.map((row) => (
                  <button
                    key={`${row.name}-${row.description}`}
                    type="button"
                    className="w-full text-left rounded-md border px-2 py-1.5 hover:bg-muted/50"
                    onClick={() => {
                      emit(row.name, row.tags ?? []);
                      setOpen(false);
                      setBatch([]);
                    }}
                  >
                    <div className="text-sm font-medium">{row.name}</div>
                    {row.description ? (
                      <div className="text-[11px] text-muted-foreground">{row.description}</div>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {!filtered.length ? (
          <p className="text-xs text-muted-foreground">Нет записей с текущими фильтрами.</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function InputLike({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      className="flex-1 min-w-0 h-7 rounded-md border border-input bg-background px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
