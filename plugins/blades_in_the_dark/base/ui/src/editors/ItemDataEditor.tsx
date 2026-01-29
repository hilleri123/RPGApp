'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { ValidationIssue, ItemData, ItemConfig } from '../types';

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
  return !('quality' in x) && Object.keys(x).length === 0;
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
    onChange(structuredClone(init) as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, onChange]);

  const value = (isPlainObject(data) ? data : {}) as ItemData;

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const err = (path: string) => issueMap.get(path)?.message;

  const set = (patch: Partial<ItemData>) => {
    onChange({ ...(structuredClone(value) as any), ...(patch as any) });
  };

  const tagsCsv = (value.tags ?? []).join(', ');

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-sm text-muted-foreground">Quality</div>
        <Input
          type="number"
          value={value.quality ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return set({ quality: null });
            set({ quality: Math.max(0, asNumber(raw, 0)) });
          }}
          className={err('quality') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
        />
        {err('quality') ? <div className="text-xs text-red-500 mt-1">{err('quality')}</div> : null}
        <div className="text-xs text-muted-foreground mt-1">
          Можно оставить пустым — бэк подставит автоматически при валидации персонажа.
        </div>
      </div>

      <div>
        <div className="text-sm text-muted-foreground">Теги (через запятую)</div>
        <Input
          value={tagsCsv}
          onChange={(e) =>
            set({
              tags: e.target.value
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
          className={err('tags') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
        />
      </div>
    </div>
  );
}
