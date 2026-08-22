'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';

import type { ValidationIssue, CharacterConfig, CharacterData, PassiveState, Trait } from '../types';

type Props = {
  data: Record<string, any>;
  config: CharacterConfig;
  issues?: ValidationIssue[];
  onChange: (next: Record<string, any>) => void;
};

function normalizeIssuePath(p: string) {
  return p.startsWith('data.') ? p.slice(5) : p;
}

function asNumber(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function uniqStr(xs: any): string[] {
  if (!Array.isArray(xs)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const s = String(x ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function toCsv(xs: any[] | undefined) {
  return (Array.isArray(xs) ? xs : []).filter(Boolean).join(', ');
}
function fromCsv(s: string) {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function addUniqueStr(xs: any, item: string): string[] {
  const cur = uniqStr(xs);
  const it = String(item ?? '').trim();
  if (!it) return cur;
  if (cur.includes(it)) return cur;
  return [...cur, it];
}

function removeStr(xs: any, item: string): string[] {
  const cur = uniqStr(xs);
  const it = String(item ?? '').trim();
  if (!it) return cur;
  return cur.filter((x) => x !== it);
}

function ensureTraitShape(xs: any): Trait[] {
  if (!Array.isArray(xs)) return [];
  const out: Trait[] = [];
  for (let i = 0; i < xs.length; i++) {
    const tr = xs[i];
    if (!isPlainObject(tr)) continue;
    const text = String(tr.text ?? '').trim();
    if (!text) continue;
    const id = String(tr.id ?? `trait_${i + 1}`).trim() || `trait_${i + 1}`;
    // meta на фронте можно держать, но если хочешь выкинуть совсем — убери
    out.push({ id, text, meta: isPlainObject(tr.meta) ? tr.meta : {} });
  }
  return out;
}

/**
 * Пассивки в персонаже: строгая форма БЕЗ meta.
 * Храним только id (и enabled если у тебя в типах обязателен).
 */
function ensurePassiveShape(xs: any): PassiveState[] {
  if (!Array.isArray(xs)) return [];
  const out: PassiveState[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < xs.length; i++) {
    const ps = xs[i];
    if (!isPlainObject(ps)) continue;
    const id = String(ps.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    // enabled можно оставить, но управлять им в UI не будем
    out.push({ id, enabled: ps.enabled !== false } as any);
  }
  return out;
}

const TRACK_KEYS = ['hp', 'eq', 'fat', 'conc', 'grudge'] as const;
type TrackKey = (typeof TRACK_KEYS)[number];

function ensureTracksShape(x: any, fallback: any) {
  const src = isPlainObject(x) ? x : {};
  const fb = isPlainObject(fallback) ? fallback : {};
  const out: any = {};
  for (const k of TRACK_KEYS) out[k] = Math.max(0, Math.floor(asNumber(src[k], asNumber(fb[k], 0))));
  return out;
}

function ensureEconomyShape(x: any, fallback: any) {
  const src = isPlainObject(x) ? x : {};
  const fb = isPlainObject(fallback) ? fallback : {};
  const out: any = {};
  for (const k of ['main', 'move', 'defense'] as const) {
    out[k] = Math.max(0, Math.floor(asNumber(src[k], asNumber(fb[k], 1))));
  }
  return out;
}

function tagLabel(tagsCatalog: any[], id: string) {
  const def = tagsCatalog.find((t) => String(t?.id) === id);
  return def?.title ?? id;
}

// ---- mastery calculation (front) ----
type PassiveLevel = 'none' | 'novice' | 'trained' | 'master' | 'legend';
const LEVEL_ORDER: Record<PassiveLevel, number> = { none: 0, novice: 1, trained: 2, master: 3, legend: 4 };

function levelFromMatches(matches: number, rules: any): PassiveLevel {
  const noviceAt = Math.max(0, Math.floor(Number(rules?.noviceAt ?? 1) || 1));
  const trainedAt = Math.max(0, Math.floor(Number(rules?.trainedAt ?? 2) || 2));
  const masterAt = Math.max(0, Math.floor(Number(rules?.masterAt ?? 3) || 3));
  const legendAt = Math.max(0, Math.floor(Number(rules?.legendAt ?? 4) || 4));

  if (matches >= legendAt) return 'legend';
  if (matches >= masterAt) return 'master';
  if (matches >= trainedAt) return 'trained';
  if (matches >= noviceAt) return 'novice';
  return 'none';
}

function computePassiveStatus(passiveDef: any, tagSet: Set<string>) {
  const id = String(passiveDef?.id ?? '').trim();
  const requiredTags = Array.isArray(passiveDef?.requiredTags) ? passiveDef.requiredTags.map((x: any) => String(x).trim()).filter(Boolean) : [];
  const keyTags = Array.isArray(passiveDef?.keyTags) ? passiveDef.keyTags.map((x: any) => String(x).trim()).filter(Boolean) : [];

  const requiredOk = requiredTags.every((t: string) => tagSet.has(t));
  const matches = keyTags.reduce((acc: number, t: string) => acc + (tagSet.has(t) ? 1 : 0), 0);

  const rules = isPlainObject(passiveDef?.masteryRules) ? passiveDef.masteryRules : {};
  const level = requiredOk ? levelFromMatches(matches, rules) : ('none' as PassiveLevel);

  // считаем “активна” = level != none
  const isActive = level !== 'none';

  return { id, requiredOk, matches, level, isActive };
}

function levelLabel(lv: PassiveLevel) {
  switch (lv) {
    case 'novice': return 'novice';
    case 'trained': return 'trained';
    case 'master': return 'master';
    case 'legend': return 'legend';
    default: return 'none';
  }
}

export default function CharacterDataEditor({ data, config, issues, onChange }: Props) {
  const [tagToAdd, setTagToAdd] = useState('');
  const [traitToAdd, setTraitToAdd] = useState('');

  useEffect(() => {
    setTagToAdd('');
    setTraitToAdd('');
  }, [config]);

  useEffect(() => {
    const hasObject = isPlainObject(data);

    if (!hasObject && config?.initialData) {
      onChange(structuredClone(config.initialData) as any);
      return;
    }

    const init = (config?.initialData ?? {}) as any;
    const next: any = structuredClone(hasObject ? data : {});
    let changed = false;

    if (next.kind !== 'pc' && next.kind !== 'npc') {
      next.kind = init.kind ?? 'pc';
      changed = true;
    }

    if (!Array.isArray(next.tags)) {
      next.tags = Array.isArray(init.tags) ? structuredClone(init.tags) : [];
      changed = true;
    } else {
      const fixed = uniqStr(next.tags);
      if (JSON.stringify(fixed) !== JSON.stringify(next.tags)) {
        next.tags = fixed;
        changed = true;
      }
    }

    if (!Array.isArray(next.traits)) {
      next.traits = Array.isArray(init.traits) ? structuredClone(init.traits) : [];
      changed = true;
    } else {
      const fixed = ensureTraitShape(next.traits);
      if (JSON.stringify(fixed) !== JSON.stringify(next.traits)) {
        next.traits = fixed;
        changed = true;
      }
    }

    {
      const fixed = ensureTracksShape(next.tracks, init.tracks);
      if (JSON.stringify(fixed) !== JSON.stringify(next.tracks)) {
        next.tracks = fixed;
        changed = true;
      }
    }
    {
      const fixed = ensureTracksShape(next.trackMax, init.trackMax);
      if (JSON.stringify(fixed) !== JSON.stringify(next.trackMax)) {
        next.trackMax = fixed;
        changed = true;
      }
    }

    {
      const fixed = ensureEconomyShape(next.economy, init.economy ?? { main: 1, move: 1, defense: 1 });
      if (JSON.stringify(fixed) !== JSON.stringify(next.economy)) {
        next.economy = fixed;
        changed = true;
      }
    }

    if (!Array.isArray(next.items)) {
      next.items = Array.isArray(init.items) ? structuredClone(init.items) : [];
      changed = true;
    } else {
      const fixed = uniqStr(next.items);
      if (JSON.stringify(fixed) !== JSON.stringify(next.items)) {
        next.items = fixed;
        changed = true;
      }
    }

    if (!Array.isArray(next.passives)) {
      next.passives = Array.isArray(init.passives) ? structuredClone(init.passives) : [];
      changed = true;
    } else {
      const fixed = ensurePassiveShape(next.passives);
      if (JSON.stringify(fixed) !== JSON.stringify(next.passives)) {
        next.passives = fixed;
        changed = true;
      }
    }

    if (changed) onChange(next);
  }, [config, data, onChange]);

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const err = (path: string) => issueMap.get(path)?.message;

  const value = (isPlainObject(data) ? data : {}) as CharacterData;

  const setPatch = (patch: Partial<CharacterData>) => {
    onChange({ ...(structuredClone(value) as any), ...(patch as any) });
  };

  const setTrack = (key: TrackKey, v: number) => {
    const next = structuredClone(value ?? {}) as any;
    next.tracks = ensureTracksShape(next.tracks, (config.initialData as any)?.tracks);
    next.tracks[key] = Math.max(0, Math.floor(v));
    onChange(next);
  };

  const setTrackMax = (key: TrackKey, v: number) => {
    const next = structuredClone(value ?? {}) as any;
    next.trackMax = ensureTracksShape(next.trackMax, (config.initialData as any)?.trackMax);
    next.trackMax[key] = Math.max(0, Math.floor(v));
    onChange(next);
  };

  const tagsCatalog = (config?.tagsCatalog ?? []) as any[];
  const traitsCatalog = ((config as any)?.traitsCatalog ?? []) as any[];
  const passivesCatalog = (config?.passivesCatalog ?? []) as any[];

  const tags = uniqStr((value as any).tags);
  const tagSet = useMemo(() => new Set(tags), [tags]);

  const traits = ensureTraitShape(value.traits);
  const itemsCsv = toCsv(value.items);

  const setTraitText = (idx: number, text: string) => {
    const next = structuredClone(value ?? {}) as any;
    next.traits = ensureTraitShape(next.traits);
    next.traits[idx] = { ...(next.traits[idx] ?? { id: `trait_${idx + 1}`, meta: {} }), text };
    onChange(next);
  };

  const removeTrait = (idx: number) => {
    const next = structuredClone(value ?? {}) as any;
    next.traits = ensureTraitShape(next.traits).filter((_, i) => i !== idx);
    onChange(next);
  };

  // --- constraints for tags (+ кнопка добавить)
  const tagTotalLimit = config?.constraints?.tagCountAtStart;
  const catLimits = (config?.constraints?.categoryLimitsAtStart ?? {}) as Record<string, number>;

  const tagIndex = useMemo(() => {
    const m = new Map<string, any>();
    for (const t of tagsCatalog) {
      const id = String(t?.id ?? '').trim();
      if (id) m.set(id, t);
    }
    return m;
  }, [tagsCatalog]);

  const countsByCat = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of tags) {
      const def = tagIndex.get(id);
      const cat = String(def?.category ?? '');
      if (!cat) continue;
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [tags, tagIndex]);

  const canAddTag = (id: string) => {
    const tid = String(id ?? '').trim();
    if (!tid) return false;
    if (tags.includes(tid)) return false;

    if (typeof tagTotalLimit === 'number' && tags.length >= tagTotalLimit) return false;

    const def = tagIndex.get(tid);
    const cat = String(def?.category ?? '');
    const lim = cat ? catLimits[cat] : undefined;
    if (cat && typeof lim === 'number') {
      if ((countsByCat[cat] ?? 0) >= lim) return false;
    }
    return true;
  };

  const canAddTrait = (id: string) => {
    const tid = String(id ?? '').trim();
    if (!tid) return false;
    if (traits.some((t) => t.id === tid)) return false;
    return true;
  };

  // ---- PASSIVES derived status (active/missing/mastery) ----
  const passivesInChar = ensurePassiveShape((value as any).passives);
  const passivesInCharIds = useMemo(() => new Set(passivesInChar.map((p) => String((p as any).id))), [passivesInChar]);

  const passiveStatuses = useMemo(() => {
    return passivesCatalog
      .map((pd) => {
        const st = computePassiveStatus(pd, tagSet);
        const isAdded = passivesInCharIds.has(st.id);
        const title = String(pd?.title ?? st.id);
        return { ...st, title, def: pd, isAdded };
      })
      .filter((x) => x.id);
  }, [passivesCatalog, tagSet, passivesInCharIds]);

  const activePassives = passiveStatuses.filter((p) => p.isActive);
  const missingActive = activePassives.filter((p) => !p.isAdded);

  const addPassiveId = (id: string) => {
    const next = structuredClone(value ?? {}) as any;
    const cur = ensurePassiveShape(next.passives);
    if (!cur.some((p: any) => p.id === id)) {
      // без meta, без ручного enabled — пусть бэк решает, но enabled=true безопасно
      cur.push({ id, enabled: true } as any);
      next.passives = cur;
      onChange(next);
    }
  };

  const removePassiveId = (id: string) => {
    const next = structuredClone(value ?? {}) as any;
    next.passives = ensurePassiveShape(next.passives).filter((p: any) => p.id !== id);
    onChange(next);
  };

  const addAllMissingActive = () => {
    if (!missingActive.length) return;
    const next = structuredClone(value ?? {}) as any;
    const cur = ensurePassiveShape(next.passives);
    const curIds = new Set(cur.map((p: any) => p.id));
    for (const p of missingActive) {
      if (!curIds.has(p.id)) cur.push({ id: p.id, enabled: true } as any);
    }
    next.passives = cur;
    onChange(next);
  };

  return (
    <div className="space-y-6">
      {/* TAGS */}
      <div className="space-y-2">
        <div className="text-sm text-white/80">
          Тэги (из справочника) {typeof tagTotalLimit === 'number' ? `— ${tags.length}/${tagTotalLimit}` : null}
        </div>

        <div className="flex gap-2 items-center">
          <select
            className="h-10 flex-1 rounded-md border border-white/10 bg-black/20 px-3 text-sm"
            value={tagToAdd}
            onChange={(e) => setTagToAdd(e.target.value)}
          >
            <option value="">Выбери тэг…</option>
            {tagsCatalog.map((t) => (
              <option key={t.id} value={t.id} disabled={!canAddTag(String(t.id)) && !tags.includes(String(t.id))}>
                {t.title ?? t.id} ({t.category})
              </option>
            ))}
          </select>

          <button
            type="button"
            className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10 disabled:opacity-50"
            disabled={!canAddTag(tagToAdd)}
            onClick={() => {
              const next = structuredClone(value ?? {}) as any;
              next.tags = addUniqueStr(next.tags, tagToAdd);
              onChange(next);
              setTagToAdd('');
            }}
            title={!canAddTag(tagToAdd) ? 'Нельзя добавить (лимит/дубликат/пусто)' : 'Добавить'}
          >
            +
          </button>
        </div>

        {err('tags') ? <div className="text-xs text-red-400">{err('tags')}</div> : null}

        {tags.length ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((id) => (
              <button
                key={id}
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/90 hover:bg-white/10"
                title="Удалить тэг"
                onClick={() => {
                  const next = structuredClone(value ?? {}) as any;
                  next.tags = removeStr(next.tags, id);
                  onChange(next);
                }}
              >
                <span>{tagLabel(tagsCatalog, id)}</span>
                <span className="text-white/50">{id}</span>
                <span className="text-white/50">×</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-white/50">Пока не выбрано.</div>
        )}
      </div>

      {/* TRACKS */}
      <div className="grid gap-2">
        <div className="text-sm text-white/80">Треки</div>

        <div className="grid grid-cols-1 gap-2">
          {TRACK_KEYS.map((k) => (
            <div key={k} className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-xs text-white/60">{k.toUpperCase()} (текущее)</div>
                <Input
                  type="number"
                  value={String((value.tracks as any)?.[k] ?? 0)}
                  onChange={(e) => setTrack(k, asNumber(e.target.value, 0))}
                  className={err(`tracks.${k}`) ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs text-white/60">{k.toUpperCase()} (макс.)</div>
                <Input
                  type="number"
                  value={String((value.trackMax as any)?.[k] ?? 0)}
                  onChange={(e) => setTrackMax(k, asNumber(e.target.value, 0))}
                  className={err(`trackMax.${k}`) ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ECONOMY */}
      <div className="grid gap-2">
        <div className="text-sm text-white/80">Экономика действий</div>
        <div className="grid grid-cols-3 gap-2">
          {(['main', 'move', 'defense'] as const).map((k) => (
            <div key={k} className="space-y-1">
              <div className="text-xs text-white/60">{k}</div>
              <Input
                type="number"
                value={String((value.economy as any)?.[k] ?? 1)}
                onChange={(e) => {
                  const next = structuredClone(value ?? {}) as any;
                  next.economy = ensureEconomyShape(next.economy, (config.initialData as any)?.economy);
                  next.economy[k] = Math.max(0, Math.floor(asNumber(e.target.value, 0)));
                  onChange(next);
                }}
                className={err(`economy.${k}`) ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ITEMS */}
      <div className="grid gap-2">
        <div className="text-sm text-white/80">Items (ids, CSV)</div>
        <Input
          value={itemsCsv}
          onChange={(e) => setPatch({ items: fromCsv(e.target.value) as any })}
          className={err('items') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
        />
        {err('items') ? <div className="text-xs text-red-400">{err('items')}</div> : null}
      </div>

      {/* TRAITS */}
      <div className="space-y-2">
        <div className="text-sm text-white/80">Traits (из справочника)</div>

        <div className="flex gap-2 items-center">
          <select
            className="h-10 flex-1 rounded-md border border-white/10 bg-black/20 px-3 text-sm"
            value={traitToAdd}
            onChange={(e) => setTraitToAdd(e.target.value)}
          >
            <option value="">Выбери trait…</option>
            {traitsCatalog.map((t) => (
              <option key={t.id} value={t.id} disabled={!canAddTrait(String(t.id))}>
                {t.id}: {String(t.text ?? '').slice(0, 60)}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10 disabled:opacity-50"
            disabled={!canAddTrait(traitToAdd)}
            onClick={() => {
              const def = traitsCatalog.find((t) => String(t?.id) === String(traitToAdd));
              if (!def) return;

              const next = structuredClone(value ?? {}) as any;
              const cur = ensureTraitShape(next.traits);

              if (!cur.some((x) => x.id === String(def.id))) {
                cur.push({
                  id: String(def.id),
                  text: String(def.text ?? ''),
                  meta: isPlainObject(def.meta) ? def.meta : {},
                });
                next.traits = cur;
                onChange(next);
              }

              setTraitToAdd('');
            }}
            title={!canAddTrait(traitToAdd) ? 'Нельзя добавить (дубликат/пусто)' : 'Добавить'}
          >
            +
          </button>
        </div>

        {traits.map((tr, idx) => (
          <div key={tr.id ?? idx} className="flex gap-2 items-center">
            <Input
              value={tr.text ?? ''}
              onChange={(e) => setTraitText(idx, e.target.value)}
              className={err(`traits.${idx}.text`) ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
            />
            <button type="button" className="text-xs text-red-300 hover:text-red-200" onClick={() => removeTrait(idx)}>
              удалить
            </button>
          </div>
        ))}

        {err('traits') ? <div className="text-xs text-red-400">{err('traits')}</div> : null}
      </div>

      {/* PASSIVES (computed + missing) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="text-sm text-white/80">Пассивки</div>
          <div className="text-xs text-white/50">
            Активны: {activePassives.length}, добавлены: {passivesInChar.length}, активны но не добавлены: {missingActive.length}
          </div>

          <button
            type="button"
            className="ml-auto h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10 disabled:opacity-50"
            disabled={!missingActive.length}
            onClick={addAllMissingActive}
            title={!missingActive.length ? 'Нет недостающих активных' : 'Добавить все активные, которых не хватает'}
          >
            + Добавить все активные
          </button>
        </div>

        {err('passives') ? <div className="text-xs text-red-400">{err('passives')}</div> : null}

        {passivesCatalog.length ? (
          <div className="space-y-2">
            {passiveStatuses.map((p) => {
              const highlight =
                p.isActive && !p.isAdded
                  ? 'border-amber-400/60 bg-amber-500/10'
                  : p.isActive
                    ? 'border-emerald-400/40 bg-emerald-500/10'
                    : 'border-white/10 bg-white/5';

              const right =
                p.isActive && !p.isAdded ? (
                  <button
                    type="button"
                    className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-xs hover:bg-white/10"
                    onClick={() => addPassiveId(p.id)}
                    title="Добавить пассивку в персонажа"
                  >
                    + добавить
                  </button>
                ) : p.isAdded ? (
                  <button
                    type="button"
                    className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-xs hover:bg-white/10"
                    onClick={() => removePassiveId(p.id)}
                    title="Убрать из персонажа (если не нужна/ошибка)"
                  >
                    убрать
                  </button>
                ) : null;

              return (
                <div key={p.id} className={`rounded-md border p-3 ${highlight}`}>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-white/90">{p.title}</div>
                    <div className="text-xs text-white/50">{p.id}</div>

                    <div className="ml-auto flex items-center gap-2">
                      <div className="text-xs text-white/70">
                        mastery: <span className="text-white/90">{levelLabel(p.level)}</span>
                        <span className="text-white/50"> ({p.matches})</span>
                      </div>
                      {right}
                    </div>
                  </div>

                  <div className="mt-1 text-xs text-white/60">
                    {p.isActive ? (
                      p.isAdded ? (
                        <span className="text-emerald-200/90">Активна и добавлена.</span>
                      ) : (
                        <span className="text-amber-200/90">Активна, но не добавлена (бэк попросит добавить).</span>
                      )
                    ) : (
                      <span>Не активна (недостаточно тэгов/совпадений).</span>
                    )}
                  </div>

                  {String(p.def?.description ?? '').trim() ? (
                    <div className="mt-2 text-xs text-white/50">{String(p.def.description)}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-white/50">Справочник пассивок пуст (придёт из config).</div>
        )}
      </div>
    </div>
  );
}
