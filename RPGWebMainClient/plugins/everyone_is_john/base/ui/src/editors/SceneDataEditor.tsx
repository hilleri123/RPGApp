'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';

import type { ValidationIssue, SceneConfig, SceneData } from '../types';
import { Button } from '@/components/ui/button';

type Props = {
  data: Record<string, any>;
  config?: SceneConfig;
  issues?: ValidationIssue[];
  onChange: (next: Record<string, any>) => void;
};

function normalizeIssuePath(p: string) {
  return p.startsWith('data.') ? p.slice(5) : p;
}

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function isEmptyData(x: any) {
  if (!isPlainObject(x)) return true;
  return Object.keys(x).length === 0;
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

export default function SceneDataEditor({ data, config, issues, onChange }: Props) {
  const initKeyRef = useRef<string | null>(null);

  // init from config.initialData if editor is empty
  useEffect(() => {
    const init = config?.initialData;
    if (!init) return;

    const key = String((config as any)?.id ?? (config as any)?.schemaId ?? 'default');
    if (initKeyRef.current === key) return;

    if (!isEmptyData(data)) {
      initKeyRef.current = key;
      return;
    }

    initKeyRef.current = key;
    onChange(structuredClone(init) as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, onChange]);

  // normalize incoming data shape
  useEffect(() => {
    const init = (config?.initialData ?? { buff: 0, character_id: null }) as SceneData;

    if (!isPlainObject(data)) {
      onChange(structuredClone(init) as any);
      return;
    }

    const next: any = structuredClone(data);
    let changed = false;

    // character_id: '' -> null, trim string
    if (next.character_id == null || next.character_id === '') {
      if (next.character_id !== null) {
        next.character_id = null;
        changed = true;
      }
    } else {
      const s = String(next.character_id).trim();
      if (s !== next.character_id) {
        next.character_id = s;
        changed = true;
      }
    }

    // buff: int + clamp
    const min = config?.constraints?.buffMin;
    const max = config?.constraints?.buffMax;

    const buffInt = clampInt(asInt(next.buff, init.buff ?? 0), min, max);
    if (buffInt !== next.buff) {
      next.buff = buffInt;
      changed = true;
    }

    if (changed) onChange(next);
  }, [config?.constraints?.buffMin, config?.constraints?.buffMax, config?.initialData, data, onChange]);

  const value = (isPlainObject(data) ? data : {}) as SceneData;

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const err = (path: string) => issueMap.get(path)?.message;

  const min = config?.constraints?.buffMin;
  const max = config?.constraints?.buffMax;

  const setPatch = (patch: Partial<SceneData>) => {
    onChange({ ...(structuredClone(value) as any), ...(patch as any) });
  };

  return (
    <div className="space-y-4">
      {/* character_id */}
      <div className="space-y-1">
        <div className="text-sm text-white/80">character_id (UUID или пусто)</div>

        {/* инпут + кнопка сброса */}
        <div className="flex gap-2">
          <Input
            value={value.character_id ?? ''}
            onChange={(e) => {
              const s = e.target.value.trim();
              setPatch({ character_id: s ? s : null });
            }}
            placeholder="Например: 92ac0fcf-f0ad-4005-8246-c961531c6002"
            className={err('character_id') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => setPatch({ character_id: null })}
            disabled={value.character_id == null}
            title="Сбросить победителя инициативы"
          >
            Сброс
          </Button>
        </div>

        {err('character_id') ? <div className="text-xs text-red-400">{err('character_id')}</div> : null}
      </div>

      {/* buff */}
      <div className="space-y-1">
        <div className="text-sm text-white/80">buff</div>
        <Input
          type="number"
          value={String(value.buff ?? 0)}
          onChange={(e) => {
            const n = clampInt(asInt(e.target.value, 0), min, max);
            setPatch({ buff: n });
          }}
          className={err('buff') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
        />
        {(typeof min === 'number' || typeof max === 'number') ? (
          <div className="text-xs text-white/50">
            {typeof min === 'number' ? `мин: ${min}` : null}
            {typeof min === 'number' && typeof max === 'number' ? ' · ' : null}
            {typeof max === 'number' ? `макс: ${max}` : null}
          </div>
        ) : null}
        {err('buff') ? <div className="text-xs text-red-400">{err('buff')}</div> : null}
      </div>
    </div>
  );
}
