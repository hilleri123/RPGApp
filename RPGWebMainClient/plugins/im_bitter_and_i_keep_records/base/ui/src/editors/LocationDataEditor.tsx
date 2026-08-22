'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';

import type { ValidationIssue, LocationConfig, LocationData } from '../types';

type Props = {
  data: Record<string, any>;
  config?: LocationConfig;
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
function isEmpty(x: any) {
  if (!isPlainObject(x)) return true;
  return Object.keys(x).length === 0;
}
function toCsv(xs: any[] | undefined) {
  return (Array.isArray(xs) ? xs : []).filter(Boolean).join(', ');
}
function fromCsv(s: string) {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export default function LocationDataEditor({ data, config, issues, onChange }: Props) {
  const initKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const init = config?.initialData;
    if (!init) return;

    const key = String((config as any)?.id ?? (config as any)?.schemaId ?? 'default');
    if (initKeyRef.current === key) return;

    if (!isEmpty(data)) {
      initKeyRef.current = key;
      return;
    }

    initKeyRef.current = key;
    onChange(structuredClone(init) as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, onChange]);

  const value = (isPlainObject(data) ? data : {}) as LocationData;

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);
  const err = (path: string) => issueMap.get(path)?.message;

  const set = (patch: Partial<LocationData>) => {
    onChange({ ...(structuredClone(value) as any), ...(patch as any) });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <div className="text-sm text-white/80">Температура (°C)</div>
        <Input
          type="number"
          value={String(value.temperatureC ?? 0)}
          onChange={(e) => set({ temperatureC: asNumber(e.target.value, 0) })}
          className={err('temperatureC') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
        />
        {err('temperatureC') ? <div className="text-xs text-red-400">{err('temperatureC')}</div> : null}
      </div>

      <div className="grid gap-2">
        <div className="text-sm text-white/80">Освещённость (0..100)</div>
        <Input
          type="number"
          value={String(value.illumination ?? 50)}
          onChange={(e) => set({ illumination: Math.max(0, Math.min(100, asNumber(e.target.value, 50))) })}
          className={err('illumination') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
        />
        {err('illumination') ? <div className="text-xs text-red-400">{err('illumination')}</div> : null}
      </div>
    </div>
  );
}
