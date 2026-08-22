'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';

import type { ValidationIssue } from '../types';
import type { ItemConfig, ItemData, DamageType, ItemType, MagicSource } from '../types';

import { TagPicker } from './common/TagPicker';

type Props = {
  data: Record<string, any>;
  config?: ItemConfig;
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

function isEmptyItemData(x: any) {
  if (!isPlainObject(x)) return true;
  return Object.keys(x).length === 0;
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

function pick<T extends Record<string, any>>(obj: T, keys: string[]) {
  const out: any = {};
  for (const k of keys) if (k in obj) out[k] = (obj as any)[k];
  return out;
}

// ---- mastery helpers ----

function toOptInt(x: any): number | undefined {
  const s = String(x ?? '').trim();
  if (!s) return undefined;
  const n = Math.floor(Number(s));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function maxPossibleMatches(reauiredTags: any): number {
  // matches считаются по reauiredTags => максимум = число reauiredTags
  return uniqStr(reauiredTags).length;
}

/**
 * Валидирует “слева направо” + отсутствие дыр + строго возрастание + upper bound по maxMatches.
 * Возвращает текст ошибки (для UI), либо null.
 */
function validateMasteryRules(r: any, maxMatches: number): string | null {
  const novice = toOptInt(r?.noviceAt);
  const trained = toOptInt(r?.trainedAt);
  const master = toOptInt(r?.masterAt);
  const legend = toOptInt(r?.legendAt);

  if (novice === undefined) return 'noviceAt обязателен';

  // верхняя граница: нельзя поставить порог > числа keyTags
  const checkMax = (name: string, v: number | undefined) => {
    if (v === undefined) return null;
    if (v > maxMatches) return `${name} не может быть больше ${maxMatches} (requiredTags: ${maxMatches})`;
    return null;
  };
  return (
    checkMax('noviceAt', novice) ||
    checkMax('trainedAt', trained) ||
    checkMax('masterAt', master) ||
    checkMax('legendAt', legend) ||

    // дырки
    (master !== undefined && trained === undefined ? 'masterAt требует trainedAt' : null) ||
    (legend !== undefined && master === undefined ? 'legendAt требует masterAt' : null) ||

    // порядок слева направо
    (trained !== undefined && trained <= novice ? 'trainedAt должен быть > noviceAt' : null) ||
    (master !== undefined && trained !== undefined && master <= trained ? 'masterAt должен быть > trainedAt' : null) ||
    (legend !== undefined && master !== undefined && legend <= master ? 'legendAt должен быть > masterAt' : null)
  );
}

/**
 * Нормализует masteryRules под constraints:
 * - очищает недоступные “правые” уровни если слева нет
 * - обрезает значения > maxMatches
 * Ничего “умно” не переставляет, только чистит недопустимое.
 */
function normalizeMasteryRules(r: any, maxMatches: number, defaults?: any) {
  const fb = defaults ?? { noviceAt: 1 };

  const noviceAt = Math.max(0, Math.floor(asNumber(r?.noviceAt, fb.noviceAt ?? 1)));

  // правые уровни optional; пустота => undefined
  let trainedAt = toOptInt(r?.trainedAt);
  let masterAt = toOptInt(r?.masterAt);
  let legendAt = toOptInt(r?.legendAt);

  // upper bound
  if (trainedAt !== undefined && trainedAt > maxMatches) trainedAt = undefined;
  if (masterAt !== undefined && masterAt > maxMatches) masterAt = undefined;
  if (legendAt !== undefined && legendAt > maxMatches) legendAt = undefined;

  // слева направо: нет trained => нельзя master/legend
  if (trainedAt === undefined) {
    masterAt = undefined;
    legendAt = undefined;
  }
  if (masterAt === undefined) {
    legendAt = undefined;
  }

  const out: any = { noviceAt };

  if (trainedAt !== undefined) out.trainedAt = trainedAt;
  if (masterAt !== undefined) out.masterAt = masterAt;
  if (legendAt !== undefined) out.legendAt = legendAt;

  if (typeof r?.note === 'string') out.note = r.note;
  else if (typeof fb.note === 'string') out.note = fb.note;

  return out;
}

function ensureTypeShape(next: any, type: ItemType, defaults?: any) {
  const baseKeys = ['type', 'requiredTags', 'keyTags', 'tags'];
  const withMastery = type !== 'consumable';
  const withDamage = type === 'weapon' || type === 'shield' || type === 'rune' || type === 'scroll';
  const withMagic = type === 'rune' || type === 'scroll';

  const allowed = [
    ...baseKeys,
    ...(withMastery ? ['masteryRules'] : []),
    ...(withDamage ? ['damage'] : []),
    ...(withMagic ? ['magic', 'magicPayload'] : []),
  ];

  const cleaned = pick(isPlainObject(next) ? next : {}, allowed);

  cleaned.type = type;
  cleaned.requiredTags = Array.isArray(cleaned.requiredTags) ? cleaned.requiredTags : [];
  cleaned.keyTags = Array.isArray(cleaned.keyTags) ? cleaned.keyTags : [];
  cleaned.tags = Array.isArray(cleaned.tags) ? cleaned.tags : [];

  const reqSet = new Set(uniqStr(cleaned.requiredTags));
  cleaned.requiredTags = Array.from(reqSet);
  cleaned.keyTags = uniqStr(cleaned.keyTags).filter((k) => reqSet.has(k));

  if (withMastery) {
    const maxMatches = maxPossibleMatches(cleaned.requiredTags);
    const fb = defaults?.masteryRules ?? { noviceAt: 1, trainedAt: 2, masterAt: 3, legendAt: 4 };
    cleaned.masteryRules = normalizeMasteryRules(
      isPlainObject(cleaned.masteryRules) ? cleaned.masteryRules : fb,
      maxMatches,
      fb
    );

    // ещё раз: если noviceAt > maxMatches — тоже обрежем (иначе при keyTags=[] будет 1>0)
    if (typeof cleaned.masteryRules.noviceAt === 'number' && cleaned.masteryRules.noviceAt > maxMatches) {
      cleaned.masteryRules.noviceAt = maxMatches;
    }
  }

  if (withDamage) cleaned.damage = Array.isArray(cleaned.damage) ? cleaned.damage : [];

  if (withMagic) {
    const want: MagicSource = type === 'rune' ? 'rune' : 'scroll';
    cleaned.magic = type === 'rune' ? 'rune' : type === 'scroll' ? 'scroll' : want;
    cleaned.magicPayload = isPlainObject(cleaned.magicPayload) ? cleaned.magicPayload : {};
  }

  return cleaned;
}

export default function ItemDataEditor({ data, config, issues, onChange }: Props) {
  const initKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const init = config?.initialData;
    if (!init) return;

    const key = String((config as any)?.id ?? (config as any)?.schemaId ?? 'default');
    if (initKeyRef.current === key) return;

    if (!isEmptyItemData(data)) {
      initKeyRef.current = key;
      return;
    }

    initKeyRef.current = key;
    const type = ((init as any).type ?? 'misc') as ItemType;
    onChange(ensureTypeShape(structuredClone(init) as any, type, init) as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, onChange]);

  const value = (isPlainObject(data) ? data : {}) as any as ItemData;

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const err = (path: string) => issueMap.get(path)?.message;

  const set = (patch: Partial<ItemData>) => {
    onChange({ ...(structuredClone(value) as any), ...(patch as any) });
  };

  const itemTypes = (config?.itemTypes ?? [
    'weapon', 'armor', 'shield', 'tool', 'consumable', 'rune', 'scroll', 'clothing', 'misc',
  ]) as ItemType[];

  const dmgTypes = (config?.damageTypes ?? ['piercing', 'slashing', 'blunt', 'fire', 'cold', 'electric']) as DamageType[];
  const magicSources = (config?.magicSources ?? ['none', 'rune', 'scroll']) as MagicSource[];

  const type = ((value as any).type ?? 'misc') as ItemType;
  const withMastery = type !== 'consumable';
  const withDamage = type === 'weapon' || type === 'shield' || type === 'rune' || type === 'scroll';
  const withMagic = type === 'rune' || type === 'scroll';

  const tagsCatalog = ((config as any)?.tagsCatalog ?? []) as any[];
  const tagOptions = useMemo(
    () =>
      tagsCatalog
        .map((t) => ({ id: String(t.id), title: t.title, category: t.category }))
        .filter((t) => t.id),
    [tagsCatalog]
  );

  const requiredTags = (value as any).requiredTags;
  const keyTags = (value as any).keyTags;
  const labels = (value as any).tags;

  const reqSet = useMemo(() => new Set(uniqStr(requiredTags)), [requiredTags]);
  const keyOptions = useMemo(() => tagOptions.filter((o: any) => reqSet.has(String(o.id))), [tagOptions, reqSet]);

  const damage = Array.isArray((value as any).damage) ? ((value as any).damage as any[]) : [];

  const setDamageRow = (idx: number, patch: any) => {
    const next = structuredClone(value ?? {}) as any;
    next.damage = Array.isArray(next.damage) ? next.damage : [];
    next.damage[idx] = { ...(next.damage[idx] ?? {}), ...(patch ?? {}) };
    onChange(ensureTypeShape(next, type, config?.initialData));
  };

  const addDamageRow = () => {
    const next = structuredClone(value ?? {}) as any;
    next.damage = Array.isArray(next.damage) ? next.damage : [];
    next.damage.push({ dtype: 'slashing', base: 0, notes: '' });
    onChange(ensureTypeShape(next, type, config?.initialData));
  };

  const removeDamageRow = (idx: number) => {
    const next = structuredClone(value ?? {}) as any;
    next.damage = (Array.isArray(next.damage) ? next.damage : []).filter((_: any, i: number) => i !== idx);
    onChange(ensureTypeShape(next, type, config?.initialData));
  };

  const maxMatches = useMemo(() => maxPossibleMatches(requiredTags), [requiredTags]);
  const masteryErr = useMemo(() => {
    if (!withMastery) return null;
    return validateMasteryRules((value as any).masteryRules, maxMatches);
  }, [withMastery, (value as any).masteryRules, maxMatches]);

  // left-to-right enable flags
  const mr = ((value as any).masteryRules ?? {}) as any;
  const noviceAt = toOptInt(mr.noviceAt);
  const trainedAt = toOptInt(mr.trainedAt);
  const masterAt = toOptInt(mr.masterAt);

  const canEditTrained = withMastery && noviceAt !== undefined; // novice всегда есть, но пусть будет так
  const canEditMaster = withMastery && trainedAt !== undefined;
  const canEditLegend = withMastery && masterAt !== undefined;

  return (
    <div className="space-y-4">
      {/* TYPE */}
      <div className="grid gap-2">
        <div className="text-sm text-white/80">Тип предмета</div>
        <select
          className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm"
          value={type as any}
          onChange={(e) => {
            const nextType = e.target.value as ItemType;
            const next = ensureTypeShape(structuredClone(value ?? {}) as any, nextType, config?.initialData);
            onChange(next);
          }}
        >
          {itemTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {err('type') ? <div className="text-xs text-red-400">{err('type')}</div> : null}
      </div>

      {/* REQUIRED TAGS */}
      <TagPicker
        label="Required tags"
        value={requiredTags}
        options={tagOptions}
        placeholder="Выбери required tag…"
        onChange={(nextReqIds: string[]) => {
          const next = structuredClone(value ?? {}) as any;
          next.requiredTags = nextReqIds;

          const nextReqSet = new Set(nextReqIds.map(String));
          const prevKey = uniqStr(next.keyTags);
          next.keyTags = prevKey.filter((k) => nextReqSet.has(k));

          onChange(ensureTypeShape(next, type, config?.initialData));
        }}
        error={err('requiredTags')}
        getOptionLabel={(o: any) => `${o.title ?? o.id} (${o.category ?? '—'})`}
      />

      {/* KEY TAGS */}
      <TagPicker
        label="Key tags (subset of required)"
        value={keyTags}
        options={keyOptions}
        placeholder={keyOptions.length ? 'Выбери key tag…' : 'Сначала добавь requiredTags…'}
        onChange={(nextKeyIds: string[]) => {
          const next = structuredClone(value ?? {}) as any;
          next.keyTags = nextKeyIds;
          onChange(ensureTypeShape(next, type, config?.initialData));
        }}
        error={err('keyTags')}
        getOptionLabel={(o: any) => `${o.title ?? o.id} (${o.category ?? '—'})`}
      />
      <div className="text-xs text-white/50">
        Ключевые тэги должны быть внутри requiredTags. Максимум совпадений = {maxMatches} (по requiredTags).
      </div>

      {/* MASTERY RULES: left-to-right + maxMatches */}
      {withMastery ? (
        <div className="grid gap-2">
          <div className="text-sm text-white/80">Mastery rules</div>

          <div className="grid grid-cols-4 gap-2">
            {/* noviceAt всегда редактируем */}
            <div className="space-y-1">
              <div className="text-xs text-white/60">noviceAt</div>
              <Input
                type="number"
                min={0}
                max={maxMatches}
                value={String(mr.noviceAt ?? '')}
                onChange={(e) => {
                  const next = structuredClone(value ?? {}) as any;
                  next.masteryRules = isPlainObject(next.masteryRules) ? next.masteryRules : {};
                  next.masteryRules.noviceAt = Math.min(maxMatches, Math.max(0, Math.floor(asNumber(e.target.value, 0))));
                  onChange(ensureTypeShape(next, type, config?.initialData));
                }}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-white/60">trainedAt</div>
              <Input
                type="number"
                min={0}
                max={maxMatches}
                disabled={!canEditTrained || maxMatches === 0}
                placeholder={!canEditTrained ? '—' : ''}
                value={mr.trainedAt === undefined ? '' : String(mr.trainedAt)}
                onChange={(e) => {
                  const next = structuredClone(value ?? {}) as any;
                  next.masteryRules = isPlainObject(next.masteryRules) ? next.masteryRules : {};
                  const raw = String(e.target.value ?? '').trim();
                  if (!raw) delete next.masteryRules.trainedAt;
                  else next.masteryRules.trainedAt = Math.min(maxMatches, Math.max(0, Math.floor(asNumber(raw, 0))));
                  onChange(ensureTypeShape(next, type, config?.initialData));
                }}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-white/60">masterAt</div>
              <Input
                type="number"
                min={0}
                max={maxMatches}
                disabled={!canEditMaster || maxMatches === 0}
                placeholder={!canEditMaster ? 'Сначала trainedAt' : ''}
                value={mr.masterAt === undefined ? '' : String(mr.masterAt)}
                onChange={(e) => {
                  const next = structuredClone(value ?? {}) as any;
                  next.masteryRules = isPlainObject(next.masteryRules) ? next.masteryRules : {};
                  const raw = String(e.target.value ?? '').trim();
                  if (!raw) delete next.masteryRules.masterAt;
                  else next.masteryRules.masterAt = Math.min(maxMatches, Math.max(0, Math.floor(asNumber(raw, 0))));
                  onChange(ensureTypeShape(next, type, config?.initialData));
                }}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-white/60">legendAt</div>
              <Input
                type="number"
                min={0}
                max={maxMatches}
                disabled={!canEditLegend || maxMatches === 0}
                placeholder={!canEditLegend ? 'Сначала masterAt' : ''}
                value={mr.legendAt === undefined ? '' : String(mr.legendAt)}
                onChange={(e) => {
                  const next = structuredClone(value ?? {}) as any;
                  next.masteryRules = isPlainObject(next.masteryRules) ? next.masteryRules : {};
                  const raw = String(e.target.value ?? '').trim();
                  if (!raw) delete next.masteryRules.legendAt;
                  else next.masteryRules.legendAt = Math.min(maxMatches, Math.max(0, Math.floor(asNumber(raw, 0))));
                  onChange(ensureTypeShape(next, type, config?.initialData));
                }}
              />
            </div>
          </div>

          {masteryErr ? <div className="text-xs text-amber-300">{masteryErr}</div> : null}
          {err('masteryRules') ? <div className="text-xs text-red-400">{err('masteryRules')}</div> : null}

          <div className="text-xs text-white/50">
            Порог не может быть больше числа ${maxMatches} requiredTags (иначе уровень недостижим). Уровни идут слева направо без дыр и строго возрастают.
          </div>
        </div>
      ) : null}

      {/* MAGIC */}
      {withMagic ? (
        <div className="grid gap-2">
          <div className="text-sm text-white/80">Магия</div>
          <select
            className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm"
            value={(((value as any).magic ?? (type === 'rune' ? 'rune' : 'scroll')) as any)}
            onChange={(e) => {
              const next = structuredClone(value ?? {}) as any;
              next.magic = e.target.value as any;
              onChange(ensureTypeShape(next, type, config?.initialData));
            }}
          >
            {magicSources.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {err('magic') ? <div className="text-xs text-red-400">{err('magic')}</div> : null}
        </div>
      ) : null}

      {/* DAMAGE */}
      {withDamage ? (
        <div className="grid gap-2">
          <div className="text-sm text-white/80">Урон</div>

          <div className="space-y-2">
            {damage.map((d, idx) => (
              <div key={idx} className="rounded-md border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <select
                    className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm"
                    value={(d?.dtype ?? 'slashing') as any}
                    onChange={(e) => setDamageRow(idx, { dtype: e.target.value })}
                  >
                    {dmgTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>

                  <Input
                    type="number"
                    value={String(d?.base ?? 0)}
                    onChange={(e) => setDamageRow(idx, { base: Math.max(0, Math.floor(asNumber(e.target.value, 0))) })}
                    className="w-28"
                  />

                  <button
                    className="ml-auto text-xs text-red-300 hover:text-red-200"
                    onClick={() => removeDamageRow(idx)}
                    type="button"
                  >
                    удалить
                  </button>
                </div>

                <Input
                  value={d?.notes ?? ''}
                  onChange={(e) => setDamageRow(idx, { notes: e.target.value })}
                  placeholder="Примечание (например: статус, особое условие)"
                />
              </div>
            ))}
          </div>

          <button
            className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10"
            onClick={addDamageRow}
            type="button"
          >
            + Добавить тип урона
          </button>

          {err('damage') ? <div className="text-xs text-red-400">{err('damage')}</div> : null}
        </div>
      ) : null}

      {/* LABEL TAGS (free labels) */}
      <TagPicker
        label="Теги (labels)"
        value={labels}
        options={Array.isArray(labels) ? labels.map((x: any) => String(x)).filter(Boolean) : []}
        placeholder="Добавь label…"
        onChange={(next) => {
          const nextObj = structuredClone(value ?? {}) as any;
          nextObj.tags = next;
          onChange(ensureTypeShape(nextObj, type, config?.initialData));
        }}
        error={err('tags')}
      />
    </div>
  );
}
