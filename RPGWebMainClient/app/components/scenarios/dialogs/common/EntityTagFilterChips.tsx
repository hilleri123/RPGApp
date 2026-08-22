'use client';

import { useMemo } from 'react';

export type EntityTagOption = { key: string; label?: string };

function toggleTag(value: string[], key: string): string[] {
  return value.includes(key) ? value.filter((t) => t !== key) : [...value, key];
}

export function collectTagKeysFromItems(
  items: Array<{ tags?: string[] | null } | null | undefined>,
  extra?: string[],
): string[] {
  const set = new Set<string>();
  for (const t of extra ?? []) {
    const k = String(t || '').trim();
    if (k) set.add(k);
  }
  for (const it of items) {
    for (const t of it?.tags ?? []) {
      const k = String(t || '').trim();
      if (k) set.add(k);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function entityHasAllTags(
  itemTags: string[] | null | undefined,
  activeTags: string[],
): boolean {
  if (!activeTags.length) return true;
  const set = new Set((itemTags ?? []).map(String));
  return activeTags.every((t) => set.has(t));
}

export function EntityTagFilterChips({
  options,
  value,
  onChange,
  size = 'xs',
}: {
  options: Array<string | EntityTagOption>;
  value: string[];
  onChange: (next: string[]) => void;
  size?: 'sm' | 'xs';
}) {
  const normalized = useMemo(() => {
    return options
      .map((o) => (typeof o === 'string' ? { key: o, label: o } : { key: o.key, label: o.label || o.key }))
      .filter((o) => o.key);
  }, [options]);

  if (!normalized.length) return null;

  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  return (
    <div className="flex flex-wrap gap-1.5">
      {normalized.map((tag) => {
        const active = value.includes(tag.key);
        return (
          <button
            key={tag.key}
            type="button"
            onClick={() => onChange(toggleTag(value, tag.key))}
            className={[
              'rounded-full border transition-colors',
              pad,
              active
                ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80',
            ].join(' ')}
            title={tag.key}
          >
            {tag.label}
          </button>
        );
      })}
      {value.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className={`rounded-full border border-white/10 text-white/40 hover:text-white/70 ${pad}`}
        >
          Сброс
        </button>
      ) : null}
    </div>
  );
}
