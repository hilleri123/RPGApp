'use client';

import { useMemo, useState } from 'react';

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

type Option =
  | string
  | {
      id: string;
      title?: string;
      category?: string;
      description?: string;
    };

type Props = {
  label: string;
  value: any;
  options: Option[];
  placeholder?: string;

  onChange: (next: string[]) => void;

  error?: string;

  limit?: number;

  // если надо подсветить “это системные тэги” vs “labels”
  pillTitle?: (id: string) => string | undefined;

  // можно отключать конкретные options (например, по лимитам)
  isOptionDisabled?: (id: string) => boolean;

  // как показывать option/pill
  getOptionLabel?: (opt: Option) => string;
};

function optId(o: Option) {
  return typeof o === 'string' ? o : String(o.id);
}

function optLabel(o: Option) {
  if (typeof o === 'string') return o;
  const id = String(o.id);
  const title = String(o.title ?? '').trim();
  const cat = String(o.category ?? '').trim();
  if (title && cat) return `${title} (${cat})`;
  if (title) return title;
  return id;
}

export function TagPicker({
  label,
  value,
  options,
  placeholder = 'Выбери тэг…',
  onChange,
  error,
  limit,
  pillTitle,
  isOptionDisabled,
  getOptionLabel,
}: Props) {
  const [toAdd, setToAdd] = useState('');

  const selected = useMemo(() => uniqStr(value), [value]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const canAdd = (id: string) => {
    const tid = String(id ?? '').trim();
    if (!tid) return false;
    if (selectedSet.has(tid)) return false;
    if (typeof limit === 'number' && selected.length >= limit) return false;
    if (isOptionDisabled?.(tid)) return false;
    return true;
  };

  const add = () => {
    if (!canAdd(toAdd)) return;
    const tid = String(toAdd).trim();
    onChange([...selected, tid]);
    setToAdd('');
  };

  const remove = (id: string) => {
    const tid = String(id).trim();
    onChange(selected.filter((x) => x !== tid));
  };

  return (
    <div className="space-y-2">
      <div className="text-sm text-white/80">
        {label}
        {typeof limit === 'number' ? <span className="text-white/50"> — {selected.length}/{limit}</span> : null}
      </div>

      <div className="flex gap-2 items-center">
        <select
          className="h-10 flex-1 rounded-md border border-white/10 bg-black/20 px-3 text-sm"
          value={toAdd}
          onChange={(e) => setToAdd(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => {
            const id = optId(o);
            const disabled = !canAdd(id) && !selectedSet.has(id);
            const text = getOptionLabel ? getOptionLabel(o) : optLabel(o);
            return (
              <option key={id} value={id} disabled={disabled}>
                {text}
              </option>
            );
          })}
        </select>

        <button
          type="button"
          className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10 disabled:opacity-50"
          disabled={!canAdd(toAdd)}
          onClick={add}
          title={!canAdd(toAdd) ? 'Нельзя добавить (лимит/дубликат/пусто)' : 'Добавить'}
        >
          +
        </button>
      </div>

      {error ? <div className="text-xs text-red-400">{error}</div> : null}

      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => (
            <button
              key={id}
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/90 hover:bg-white/10"
              title={pillTitle?.(id) ?? 'Удалить'}
              onClick={() => remove(id)}
            >
              <span>{id}</span>
              <span className="text-white/50">×</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-sm text-white/50">Пока не выбрано.</div>
      )}
    </div>
  );
}
