'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CharacterData, PbtaConfig } from '../types/character';
import type { Spell } from '../../../../../base/ui/src/types/pbta';
import type { CharacterDataChange, CharacterSpellEntry } from '../../../../../base/ui/src/types/character';
import { preparedLevelSum } from '../../../../../base/ui/src/types/character';

type Props = {
  playbookId: string;
  pbtaConfig?: PbtaConfig | null;
  data: CharacterData;
  editable?: boolean;
  onChange?: CharacterDataChange<CharacterData>;
};

type BookFilter = 'class' | 'all' | string; // string = spell_book.id

function levelLabel(level: number): string {
  if (level === 0) return 'Фокусы';
  return `${level} ур.`;
}

function newEntryId(spellId: string) {
  return `spell_${spellId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function spellsForClass(allSpells: Spell[], classId: string): Spell[] {
  if (!classId) return [];
  return allSpells.filter((s) => (s.classes ?? []).includes(classId));
}

function matchQuery(text: string, q: string): boolean {
  if (!q) return true;
  return text.toLowerCase().includes(q.toLowerCase());
}

function isFocusSchool(school: string | undefined): boolean {
  return String(school || '') === 'фокус';
}

export function SpellBookPanel({
  playbookId,
  pbtaConfig,
  data,
  editable = false,
  onChange,
}: Props) {
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');
  const [bookFilter, setBookFilter] = useState<BookFilter>('class');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [customTitle, setCustomTitle] = useState('');
  const [customLevel, setCustomLevel] = useState(1);
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});

  const allBooks = pbtaConfig?.spell_books ?? [];
  const allSpells = pbtaConfig?.spells ?? [];

  const classBook = useMemo(
    () => allBooks.find((b) => b.class_id === playbookId) ?? null,
    [allBooks, playbookId],
  );

  const owned = data.spellcasting?.spells ?? [];
  const ownedIds = useMemo(
    () => new Set(owned.map((s) => String(s.spell_id || '')).filter(Boolean)),
    [owned],
  );

  const catalogSpells = useMemo(() => {
    let list: Spell[] = [];
    if (bookFilter === 'class') {
      list = spellsForClass(allSpells, classBook?.class_id || playbookId);
    } else if (bookFilter === 'all') {
      list = [...allSpells];
    } else {
      const b = allBooks.find((x) => x.id === bookFilter);
      list = b ? spellsForClass(allSpells, b.class_id) : [];
    }
    return list.sort(
      (a, b) => a.level - b.level || a.title.localeCompare(b.title, 'ru'),
    );
  }, [allSpells, allBooks, bookFilter, classBook, playbookId]);

  const levelsAvailable = useMemo(() => {
    const set = new Set<number>();
    for (const s of catalogSpells) set.add(s.level);
    return [...set].sort((a, b) => a - b);
  }, [catalogSpells]);

  const schoolsAvailable = useMemo(() => {
    const set = new Set<string>();
    for (const s of catalogSpells) {
      if (s.school) set.add(s.school);
    }
    for (const s of owned) {
      if (s.school) set.add(s.school);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [catalogSpells, owned]);

  const availableSpells = useMemo(() => {
    return catalogSpells.filter((s) => {
      if (ownedIds.has(s.id)) return false;
      if (levelFilter !== 'all' && s.level !== levelFilter) return false;
      if (schoolFilter !== 'all' && (s.school || '') !== schoolFilter) return false;
      if (!matchQuery(`${s.title} ${s.description || ''} ${(s.tags || []).join(' ')}`, query)) {
        return false;
      }
      return true;
    });
  }, [catalogSpells, ownedIds, levelFilter, schoolFilter, query]);

  const knownSorted = useMemo(() => {
    return [...owned].sort(
      (a, b) =>
        Number(a.level ?? 0) - Number(b.level ?? 0) ||
        String(a.title || '').localeCompare(String(b.title || ''), 'ru'),
    );
  }, [owned]);

  const withSpells = (recipe: (spells: CharacterSpellEntry[], prev: CharacterData) => CharacterSpellEntry[]) => {
    if (!editable || !onChange) return;
    onChange((prev) => {
      const current = prev.spellcasting?.spells ?? [];
      const spells = recipe(current, prev);
      return {
        ...structuredClone(prev),
        spellcasting: { ...(prev.spellcasting ?? {}), spells },
      } as CharacterData;
    });
  };

  const entryFromSpell = (
    spell: Spell,
    source: CharacterSpellEntry['source'] = 'codex',
  ): CharacterSpellEntry => {
    const isOwnClass = playbookId && (spell.classes ?? []).includes(playbookId);
    const school = spell.school || '';
    return {
      id: newEntryId(spell.id),
      spell_id: spell.id,
      title: spell.title,
      level: spell.level,
      prepared: isFocusSchool(school),
      amount: 1,
      source: source === 'codex' && !isOwnClass ? 'other_playbook' : source,
      school,
      tags: [...(spell.tags ?? [])],
      description: spell.description || '',
      notes: '',
      free: false,
    };
  };

  const addSpell = (spell: Spell) => {
    withSpells((spells) => {
      if (spells.some((s) => s.spell_id === spell.id)) return spells;
      return [...spells, entryFromSpell(spell)];
    });
  };

  const addMany = (spellsToAdd: Spell[]) => {
    if (spellsToAdd.length === 0) return;
    withSpells((spells) => {
      const next = [...spells];
      const have = new Set(next.map((s) => String(s.spell_id || '')));
      for (const spell of spellsToAdd) {
        if (have.has(spell.id)) continue;
        next.push(entryFromSpell(spell));
        have.add(spell.id);
      }
      return next;
    });
  };

  const addCustom = () => {
    if (!customTitle.trim()) return;
    const title = customTitle.trim();
    const level = customLevel;
    withSpells((spells) => [
      ...spells,
      {
        id: newEntryId('custom'),
        spell_id: '',
        title,
        level,
        prepared: false,
        amount: 1,
        source: 'custom',
        school: '',
        tags: [],
        description: '',
        notes: '',
        free: false,
      },
    ]);
    setCustomTitle('');
  };

  const removeOwned = (id: string) => {
    withSpells((spells) => spells.filter((s) => s.id !== id));
    setTagDraft((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const patchOwned = (id: string, patch: Partial<CharacterSpellEntry>) => {
    withSpells((spells) => spells.map((s) => {
      if (s.id !== id) return s;
      const next = { ...s, ...patch };
      if (next.free) next.prepared = true;
      return next;
    }));
  };

  const charLevel = Number(data.level ?? 1);
  const budget = charLevel + 1;
  const used = preparedLevelSum(data);

  const chip = (active: boolean) =>
    [
      'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
      active
        ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
        : 'border-white/10 bg-black/30 text-white/55 hover:border-white/25 hover:text-white/80',
    ].join(' ');

  const fieldClass = 'w-full rounded border border-white/15 bg-black/40 px-2 py-1 text-xs text-white placeholder:text-white/35';

  return (
    <section className="flex flex-col gap-3 min-h-[28rem]">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="text-sm text-gray-300">Заклинания</div>
        <div className={`text-xs font-mono ${used > budget ? 'text-amber-300' : 'text-white/50'}`}>
          подготовка Σ{used} / {budget}
        </div>
      </div>

      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="catalog">Каталог</TabsTrigger>
          <TabsTrigger value="known">Изученные ({owned.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-3 space-y-3">
          <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-3 space-y-2.5">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                className="flex-1 min-w-[12rem] rounded border border-white/15 bg-black/40 px-2.5 py-1.5 text-sm text-white placeholder:text-white/35"
                placeholder="Поиск по названию…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white/80"
                value={bookFilter}
                onChange={(e) => setBookFilter(e.target.value as BookFilter)}
              >
                <option value="class">Книга класса{classBook ? `: ${classBook.title}` : ''}</option>
                <option value="all">Все заклинания кодекса</option>
                {allBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.class_id})
                  </option>
                ))}
              </select>
              {schoolsAvailable.length > 0 ? (
                <select
                  className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white/80"
                  value={schoolFilter}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                >
                  <option value="all">Все школы</option>
                  {schoolsAvailable.map((sc) => (
                    <option key={sc} value={sc}>
                      {sc}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={chip(levelFilter === 'all')} onClick={() => setLevelFilter('all')}>
                Все уровни
              </button>
              {levelsAvailable.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={chip(levelFilter === lvl)}
                  onClick={() => setLevelFilter(lvl)}
                >
                  {levelLabel(lvl)}
                </button>
              ))}
            </div>

            {editable ? (
              <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-white/5">
                <button
                  type="button"
                  disabled={availableSpells.length === 0}
                  className="rounded border border-amber-400/45 bg-amber-950/30 px-2.5 py-1 text-[11px] text-amber-100 disabled:opacity-40"
                  onClick={() => addMany(availableSpells)}
                >
                  + все в списке ({availableSpells.length})
                </button>
                <div className="flex flex-wrap gap-1.5 items-center ml-auto">
                  <input
                    className="rounded border border-white/15 bg-black/40 px-2 py-1 text-xs text-white min-w-[8rem]"
                    placeholder="Своё заклинание…"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    max={9}
                    className="w-12 rounded border border-white/15 bg-black/40 px-1.5 py-1 text-xs text-white"
                    value={customLevel}
                    onChange={(e) => setCustomLevel(Number(e.target.value) || 0)}
                  />
                  <button
                    type="button"
                    className="rounded border border-violet-400/40 px-2 py-1 text-[11px] text-violet-100"
                    onClick={addCustom}
                  >
                    + своё
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col min-h-[18rem] rounded-lg border border-violet-900/40 bg-violet-950/10 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-violet-900/35 bg-violet-950/25">
              <div className="text-xs font-medium text-violet-100">Ещё не добавлено</div>
              <div className="text-[10px] text-violet-200/50">{availableSpells.length}</div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[min(60vh,32rem)] divide-y divide-violet-900/25">
              {availableSpells.length === 0 ? (
                <div className="px-3 py-6 text-xs text-white/35 text-center">
                  Ничего не найдено по фильтрам
                </div>
              ) : (
                availableSpells.map((spell) => (
                  <div
                    key={spell.id}
                    className="px-3 py-2 flex items-start justify-between gap-2 hover:bg-violet-950/30"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-gray-100 truncate">{spell.title}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">
                        {levelLabel(spell.level)}
                        {spell.school ? ` · ${spell.school}` : ''}
                        {spell.classes?.length && !spell.classes.includes(playbookId)
                          ? ` · ${spell.classes.join(', ')}`
                          : ''}
                      </div>
                      {spell.description ? (
                        <div className="mt-1 text-[11px] text-white/45 line-clamp-2">
                          {spell.description}
                        </div>
                      ) : null}
                    </div>
                    {editable ? (
                      <button
                        type="button"
                        className="shrink-0 rounded border border-violet-400/45 px-2 py-1 text-[10px] text-violet-100"
                        onClick={() => addSpell(spell)}
                      >
                        +
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="known" className="mt-3">
          {knownSorted.length === 0 ? (
            <div className="rounded border border-dashed border-white/15 px-3 py-6 text-xs text-white/35 text-center">
              Пока ничего не изучено — добавьте из каталога или своё заклинание.
            </div>
          ) : (
            <div className="space-y-3">
              {knownSorted.map((s) => {
                const focus = isFocusSchool(s.school);
                const free = Boolean(s.free);
                return (
                  <div
                    key={s.id}
                    className="rounded-lg border border-emerald-900/40 bg-emerald-950/10 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {editable ? (
                        <input
                          className={`${fieldClass} flex-1 min-w-[12rem] text-sm`}
                          value={s.title || ''}
                          placeholder="Название"
                          onChange={(e) => patchOwned(s.id, { title: e.target.value })}
                        />
                      ) : (
                        <div className="flex-1 text-sm text-gray-100">{s.title || s.spell_id || s.id}</div>
                      )}
                      {editable ? (
                        <label className="flex items-center gap-1 text-[11px] text-white/55">
                          ур.
                          <input
                            type="number"
                            min={0}
                            max={9}
                            className="w-12 rounded border border-white/15 bg-black/40 px-1.5 py-1 text-xs text-white"
                            value={Number(s.level ?? 0)}
                            onChange={(e) => patchOwned(s.id, { level: Number(e.target.value) || 0 })}
                          />
                        </label>
                      ) : (
                        <div className="text-[11px] text-white/45">{levelLabel(Number(s.level ?? 0))}</div>
                      )}
                      {editable ? (
                        <button
                          type="button"
                          className="text-[11px] text-red-300/80 hover:text-red-200"
                          onClick={() => removeOwned(s.id)}
                        >
                          убрать
                        </button>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {editable ? (
                        <input
                          className={`${fieldClass} min-w-[8rem] max-w-[14rem]`}
                          list="spell-schools"
                          value={s.school || ''}
                          placeholder="Школа"
                          onChange={(e) => patchOwned(s.id, { school: e.target.value })}
                        />
                      ) : s.school ? (
                        <span className="text-[11px] text-white/50">{s.school}</span>
                      ) : null}
                      {editable ? (
                        <button
                          type="button"
                          aria-pressed={focus}
                          className={chip(focus)}
                          onClick={() => patchOwned(s.id, { school: focus ? '' : 'фокус' })}
                        >
                          Фокус
                        </button>
                      ) : focus ? (
                        <span className="text-[11px] text-violet-200">фокус</span>
                      ) : null}
                      <label className="flex items-center gap-1.5 text-[11px] text-white/70 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-emerald-500"
                          checked={free}
                          disabled={!editable}
                          onChange={(e) => patchOwned(s.id, { free: e.target.checked, prepared: e.target.checked ? true : s.prepared })}
                        />
                        бесплатное
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-white/70 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-violet-500"
                          checked={free || Boolean(s.prepared)}
                          disabled={!editable || free}
                          onChange={(e) => patchOwned(s.id, { prepared: e.target.checked })}
                        />
                        подготовлено
                      </label>
                      {s.source === 'custom' ? (
                        <span className="text-[10px] text-white/35">своё</span>
                      ) : null}
                      {s.source === 'other_playbook' ? (
                        <span className="text-[10px] text-white/35">другой класс</span>
                      ) : null}
                    </div>

                    {editable ? (
                      <input
                        className={fieldClass}
                        value={tagDraft[s.id] ?? (s.tags ?? []).join(', ')}
                        placeholder="Теги через запятую"
                        onChange={(e) => {
                          const raw = e.target.value;
                          setTagDraft((prev) => ({ ...prev, [s.id]: raw }));
                          patchOwned(s.id, {
                            tags: raw.split(',').map((t) => t.trim()).filter(Boolean),
                          });
                        }}
                      />
                    ) : (s.tags ?? []).length > 0 ? (
                      <div className="text-[11px] text-white/45">{(s.tags ?? []).join(', ')}</div>
                    ) : null}

                    {editable ? (
                      <textarea
                        className={`${fieldClass} min-h-[3.5rem] resize-y`}
                        value={s.description || ''}
                        placeholder="Описание"
                        onChange={(e) => patchOwned(s.id, { description: e.target.value })}
                      />
                    ) : s.description ? (
                      <div className="text-[11px] text-white/55 whitespace-pre-line">{s.description}</div>
                    ) : null}

                    {editable ? (
                      <textarea
                        className={`${fieldClass} min-h-[2.5rem] resize-y`}
                        value={s.notes || ''}
                        placeholder="Заметки"
                        onChange={(e) => patchOwned(s.id, { notes: e.target.value })}
                      />
                    ) : s.notes ? (
                      <div className="text-[11px] text-white/40 whitespace-pre-line">{s.notes}</div>
                    ) : null}

                    <div className="text-[10px] text-white/35">
                      {free
                        ? 'Не входит в сумму и всегда подготовлено.'
                        : focus
                          ? 'Фокус не входит в сумму и отмечается при подготовке.'
                          : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {editable && schoolsAvailable.length > 0 ? (
            <datalist id="spell-schools">
              {schoolsAvailable.map((sc) => (
                <option key={sc} value={sc} />
              ))}
            </datalist>
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  );
}
