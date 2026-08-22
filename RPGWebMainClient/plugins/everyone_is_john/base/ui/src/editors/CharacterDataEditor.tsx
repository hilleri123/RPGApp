'use client';

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';

import type { ValidationIssue, CharacterConfig, CharacterData } from '../types';

type Props = {
  data: Record<string, any>;
  config: CharacterConfig;
  issues?: ValidationIssue[];
  onChange: (next: Record<string, any>) => void;
};

function normalizeIssuePath(p: string) {
  return p.startsWith('data.') ? p.slice(5) : p;
}

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function asInt(x: any, fb = 0) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fb;
  return Math.trunc(n);
}

function clampInt(n: number, min?: number, max?: number) {
  let v = Math.trunc(n);
  if (typeof min === 'number') v = Math.max(min, v);
  if (typeof max === 'number') v = Math.min(max, v);
  return v;
}

export default function CharacterDataEditor({ data, config, issues, onChange }: Props) {
  useEffect(() => {
    const hasObject = isPlainObject(data);
    const init = (config?.initialData ?? { profession: '', tokens: 0 }) as CharacterData;

    if (!hasObject) {
      onChange(structuredClone(init) as any);
      return;
    }

    const next: any = structuredClone(data);
    let changed = false;

    // profession normalize
    if (typeof next.profession !== 'string') {
      next.profession = String(next.profession ?? '');
      changed = true;
    }
    const trimmed = next.profession.trim();
    if (trimmed !== next.profession) {
      next.profession = trimmed;
      changed = true;
    }
    if (!next.profession && (init as any).profession) {
      next.profession = (init as any).profession;
      changed = true;
    }

    // tokens normalize (NonNegativeInt)
    const tMin = (config as any)?.constraints?.tokensMin;
    const tMax = (config as any)?.constraints?.tokensMax;

    const tokensInit = typeof (init as any).tokens === 'number' ? (init as any).tokens : 0;
    const tokensInt = clampInt(asInt(next.tokens, tokensInit), 0, typeof tMax === 'number' ? tMax : undefined);
    const tokensClamped = typeof tMin === 'number' ? Math.max(tMin, tokensInt) : tokensInt;

    if (tokensClamped !== next.tokens) {
      next.tokens = tokensClamped;
      changed = true;
    }

    // если tokens отсутствует — подставим дефолт
    if (next.tokens == null) {
      next.tokens = tokensClamped ?? 10;
      changed = true;
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

  const minLen = config?.constraints?.professionMinLen;
  const maxLen = config?.constraints?.professionMaxLen;

  const tMin = (config as any)?.constraints?.tokensMin;
  const tMax = (config as any)?.constraints?.tokensMax;

  return (
    <div className="space-y-4">
      {/* profession */}
      <div className="space-y-1">
        <div className="text-sm text-white/80">Профессия</div>

        <Input
          value={value.profession ?? ''}
          onChange={(e) => setPatch({ profession: e.target.value })}
          placeholder="Например: механик, шпион, врач…"
          className={err('profession') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
        />

        {typeof minLen === 'number' || typeof maxLen === 'number' ? (
          <div className="text-xs text-white/50">
            {typeof minLen === 'number' ? `мин: ${minLen}` : null}
            {typeof minLen === 'number' && typeof maxLen === 'number' ? ' · ' : null}
            {typeof maxLen === 'number' ? `макс: ${maxLen}` : null}
          </div>
        ) : null}

        {err('profession') ? <div className="text-xs text-red-400">{err('profession')}</div> : null}
      </div>

      {/* tokens */}
      <div className="space-y-1">
        <div className="text-sm text-white/80">Жетоны (tokens)</div>

        <Input
          type="number"
          min={typeof tMin === 'number' ? tMin : 0}
          max={typeof tMax === 'number' ? tMax : undefined}
          value={String((value as any).tokens ?? 0)}
          onChange={(e) => {
            const raw = asInt(e.target.value, 0);
            const n = clampInt(raw, 0, typeof tMax === 'number' ? tMax : undefined);
            const n2 = typeof tMin === 'number' ? Math.max(tMin, n) : n;
            setPatch({ tokens: n2 } as any);
          }}
          className={err('tokens') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
        />

        {typeof tMin === 'number' || typeof tMax === 'number' ? (
          <div className="text-xs text-white/50">
            {typeof tMin === 'number' ? `мин: ${tMin}` : null}
            {typeof tMin === 'number' && typeof tMax === 'number' ? ' · ' : null}
            {typeof tMax === 'number' ? `макс: ${tMax}` : null}
          </div>
        ) : null}

        {err('tokens') ? <div className="text-xs text-red-400">{err('tokens')}</div> : null}
      </div>
    </div>
  );
}
