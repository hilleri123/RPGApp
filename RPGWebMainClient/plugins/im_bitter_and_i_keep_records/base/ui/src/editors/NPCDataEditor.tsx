'use client';

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';

import type { ValidationIssue, NpcConfig, NpcData } from '../types';

type Props = {
  data: Record<string, any>;
  config: NpcConfig;
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
function toCsv(xs: any[] | undefined) {
  return (Array.isArray(xs) ? xs : []).filter(Boolean).join(', ');
}
function fromCsv(s: string) {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export default function NPCDataEditor({ data, config, issues, onChange }: Props) {
  useEffect(() => {
    const hasObject = isPlainObject(data);
    if (!hasObject && config?.initialData) {
      onChange(structuredClone(config.initialData) as any);
      return;
    }
    const next: any = structuredClone(hasObject ? data : {});
    let changed = false;

    if (!Array.isArray(next.tags)) { next.tags = []; changed = true; }
    if (!isPlainObject(next.tracks)) { next.tracks = structuredClone((config.initialData as any).tracks ?? { hp: 3, eq: 2 }); changed = true; }
    if (!isPlainObject(next.trackMax)) { next.trackMax = structuredClone((config.initialData as any).trackMax ?? { hp: 3, eq: 2 }); changed = true; }
    if (!isPlainObject(next.economy)) { next.economy = structuredClone((config.initialData as any).economy ?? { main: 1, move: 1, defense: 1 }); changed = true; }
    if (!Array.isArray(next.items)) { next.items = []; changed = true; }

    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);
  const err = (path: string) => issueMap.get(path)?.message;

  const value = (isPlainObject(data) ? data : {}) as NpcData;

  const setPatch = (patch: Partial<NpcData>) => onChange({ ...(structuredClone(value) as any), ...(patch as any) });

  const setTrack = (key: 'hp' | 'eq', v: number) => {
    const next = structuredClone(value ?? {}) as any;
    next.tracks = isPlainObject(next.tracks) ? next.tracks : {};
    next.tracks[key] = Math.max(0, Math.floor(v));
    onChange(next);
  };

  const setTrackMax = (key: 'hp' | 'eq', v: number) => {
    const next = structuredClone(value ?? {}) as any;
    next.trackMax = isPlainObject(next.trackMax) ? next.trackMax : {};
    next.trackMax[key] = Math.max(0, Math.floor(v));
    onChange(next);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-2">
        <div className="text-sm text-white/80">Имя NPC</div>
        <Input value={value.name ?? ''} onChange={(e) => setPatch({ name: e.target.value })} />
      </div>

      <div className="grid gap-2">
        <div className="text-sm text-white/80">Тэги (CSV)</div>
        <Input value={toCsv(value.tags)} onChange={(e) => setPatch({ tags: fromCsv(e.target.value) })} />
        {err('tags') ? <div className="text-xs text-red-400">{err('tags')}</div> : null}
      </div>

      <div className="grid gap-2">
        <div className="text-sm text-white/80">Треки</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-xs text-white/60">HP</div>
            <Input type="number" value={String((value.tracks as any)?.hp ?? 0)} onChange={(e) => setTrack('hp', asNumber(e.target.value, 0))} />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-white/60">EQ</div>
            <Input type="number" value={String((value.tracks as any)?.eq ?? 0)} onChange={(e) => setTrack('eq', asNumber(e.target.value, 0))} />
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-sm text-white/80">Пределы</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-xs text-white/60">HP MAX</div>
            <Input type="number" value={String((value.trackMax as any)?.hp ?? 0)} onChange={(e) => setTrackMax('hp', asNumber(e.target.value, 0))} />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-white/60">EQ MAX</div>
            <Input type="number" value={String((value.trackMax as any)?.eq ?? 0)} onChange={(e) => setTrackMax('eq', asNumber(e.target.value, 0))} />
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-sm text-white/80">Items (ids, CSV)</div>
        <Input value={toCsv(value.items)} onChange={(e) => setPatch({ items: fromCsv(e.target.value) })} />
        {err('items') ? <div className="text-xs text-red-400">{err('items')}</div> : null}
      </div>
    </div>
  );
}
