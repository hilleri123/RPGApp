'use client';

import { useMemo, useState } from 'react';
import type { PbtaConfig, Spell } from '../types/pbta';
import type { CharacterData, CharacterSpellEntry } from '../../../../../base/ui/src/types/character';
import { preparedLevelSum } from '../../../../../base/ui/src/types/character';

type Props = {
  playbookId: string;
  pbtaConfig?: PbtaConfig | null;
  data: CharacterData;
  editable?: boolean;
  onChange?: (next: CharacterData) => void;
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
  const [ownedOnlyPrepared, setOwnedOnlyPrepared] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customLevel, setCustomLevel] = useState(1);

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
    for (const s of owned) set.add(Number(s.level ?? 0));
    return [...set].sort((a, b) => a - b);
  }, [catalogSpells, owned]);

  const schoolsAvailable = useMemo(() => {
    const set = new Set<string>();
    for (const s of catalogSpells) {
      if (s.school) set.add(s.school);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [catalogSpells]);

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

  const knownFiltered = useMemo(() => {
    return owned
      .filter((s) => {
        if (ownedOnlyPrepared && !s.prepared) return false;
        if (levelFilter !== 'all' && Number(s.level ?? 0) !== levelFilter) return false;
        if (!matchQuery(`${s.title || ''} ${s.spell_id || ''}`, query)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          Number(a.level ?? 0) - Number(b.level ?? 0) ||
          String(a.title || '').localeCompare(String(b.title || ''), 'ru'),
      );
  }, [owned, ownedOnlyPrepared, levelFilter, query]);

  const commitSpells = (spells: CharacterSpellEntry[]) => {
    if (!editable || !onChange) return;
    onChange({ ...structuredClone(data), spellcasting: { spells } });
  };

  const entryFromSpell = (
    spell: Spell,
    source: CharacterSpellEntry['source'] = 'codex',
  ): CharacterSpellEntry => {
    const isOwnClass = playbookId && (spell.classes ?? []).includes(playbookId);
    return {
      id: newEntryId(spell.id),
      spell_id: spell.id,
      title: spell.title,
      level: spell.level,
      prepared: false,
      amount: 1,
      source: source === 'codex' && !isOwnClass ? 'other_playbook' : source,
    };
  };

  const addSpell = (spell: Spell) => {
    if (!editable || !onChange) return;
    const spells = [...owned];
    if (spells.some((s) => s.spell_id === spell.id)) return;
    spells.push(entryFromSpell(spell));
    commitSpells(spells);
  };

  const addMany = (spellsToAdd: Spell[]) => {
    if (!editable || !onChange || spellsToAdd.length === 0) return;
    const spells = [...owned];
    const have = new Set(spells.map((s) => String(s.spell_id || '')));
    let added = 0;
    for (const spell of spellsToAdd) {
      if (have.has(spell.id)) continue;
      spells.push(entryFromSpell(spell));
      have.add(spell.id);
      added += 1;
    }
    if (added > 0) commitSpells(spells);
  };

  const addCustom = () => {
    if (!editable || !onChange || !customTitle.trim()) return;
    commitSpells([
      ...owned,
      {
        id: newEntryId('custom'),
        spell_id: '',
        title: customTitle.trim(),
        level: customLevel,
        prepared: false,
        amount: 1,
        source: 'custom',
      },
    ]);
    setCustomTitle('');
  };

  const removeOwned = (id: string) => {
    if (!editable || !onChange) return;
    commitSpells(owned.filter((s) => s.id !== id));
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

  return (
    <section className="flex flex-col gap-3 min-h-[28rem]">
      {/* Header + budget */}
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="text-sm text-gray-300">Заклинания</div>
        <div className={`text-xs font-mono ${used > budget ? 'text-amber-300' : 'text-white/50'}`}>
          подготовка Σ{used} / {budget}
        </div>
      </div>

      {/* Filters */}
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
          <label className="flex items-center gap-1.5 text-[11px] text-white/55 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ownedOnlyPrepared}
              onChange={(e) => setOwnedOnlyPrepared(e.target.checked)}
              className="accent-violet-500"
            />
            справа только prepared
          </label>
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
              + все слева ({availableSpells.length})
            </button>
            <div className="flex flex-wrap gap-1.5 items-center ml-auto">
              <input
                className="rounded border border-white/15 bg-black/40 px-2 py-1 text-xs text-white min-w-[8rem]"
                placeholder="Custom…"
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
                + custom
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0 flex-1">
        {/* Left: not added */}
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

        {/* Right: known */}
        <div className="flex flex-col min-h-[18rem] rounded-lg border border-emerald-900/35 bg-emerald-950/10 overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-emerald-900/35 bg-emerald-950/20">
            <div className="text-xs font-medium text-emerald-100">Известные</div>
            <div className="text-[10px] text-emerald-200/50">
              {knownFiltered.length}
              {knownFiltered.length !== owned.length ? ` / ${owned.length}` : ''}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[min(60vh,32rem)] divide-y divide-emerald-900/20">
            {knownFiltered.length === 0 ? (
              <div className="px-3 py-6 text-xs text-white/35 text-center">
                {owned.length === 0
                  ? 'Список пуст — добавь слева'
                  : 'Нет совпадений с фильтрами'}
              </div>
            ) : (
              knownFiltered.map((s) => (
                <div
                  key={s.id}
                  className="px-3 py-2 flex items-start justify-between gap-2 hover:bg-emerald-950/25"
                >
                  <div className="min-w-0">
                    <div className={`text-sm truncate ${s.prepared ? 'text-violet-200' : 'text-gray-100'}`}>
                      {s.prepared ? '✓ ' : ''}
                      {s.title || s.spell_id || s.id}
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5">
                      {levelLabel(Number(s.level ?? 0))}
                      {s.amount && s.amount > 1 ? ` · ×${s.amount}` : ''}
                      {s.source === 'custom' ? ' · custom' : ''}
                      {s.source === 'other_playbook' ? ' · другой класс' : ''}
                    </div>
                  </div>
                  {editable ? (
                    <button
                      type="button"
                      className="shrink-0 text-[10px] text-red-300/75 hover:text-red-200"
                      onClick={() => removeOwned(s.id)}
                    >
                      убрать
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
