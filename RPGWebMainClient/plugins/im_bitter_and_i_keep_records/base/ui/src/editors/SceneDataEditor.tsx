'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

import type { ValidationIssue } from '../types';
import type { SceneConfig, SceneData, SceneMode, CombatPhase } from '../types';

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

function asStr(x: any, fb = '') {
  const s = String(x ?? '').trim();
  return s || fb;
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

function ensureModeShape(next: any, mode: SceneMode) {
  const base: any = isPlainObject(next) ? structuredClone(next) : {};
  const out: any = { mode };

  if (mode === 'travel') {
    out.travel = isPlainObject(base.travel) ? base.travel : { pace: 'normal' };
    out.rest = null;
    out.combat = null;
    out.travel.pace = asStr(out.travel.pace, 'normal');
  }

  if (mode === 'rest') {
    out.rest = isPlainObject(base.rest) ? base.rest : { camp: false };
    out.travel = null;
    out.combat = null;
    out.rest.camp = Boolean(out.rest.camp);
  }

  if (mode === 'combat') {
    const c = isPlainObject(base.combat) ? base.combat : {};
    out.combat = {
      phase: asStr(c.phase, 'turn') as CombatPhase,
      initiativeOrder: uniqStr(c.initiativeOrder),
      activeIndex: Number.isFinite(Number(c.activeIndex)) ? Math.max(0, Math.floor(Number(c.activeIndex))) : 0,
      contacts: Array.isArray(c.contacts) ? c.contacts : [],
    };
    out.travel = null;
    out.rest = null;

    // clamp activeIndex
    if (!out.combat.initiativeOrder.length) out.combat.activeIndex = 0;
    if (out.combat.activeIndex >= out.combat.initiativeOrder.length) out.combat.activeIndex = 0;

    // normalize contacts to unique sorted pairs
    const norm: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const p of out.combat.contacts) {
      const a = String(p?.[0] ?? '').trim();
      const b = String(p?.[1] ?? '').trim();
      if (!a || !b || a === b) continue;
      const x = a < b ? a : b;
      const y = a < b ? b : a;
      const key = `${x}::${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      norm.push([x, y]);
    }
    out.combat.contacts = norm;
  }

  return out;
}

export default function SceneDataEditor({ data, config, issues, onChange }: Props) {
  const initKeyRef = useRef<string | null>(null);

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
    const mode = (asStr((init as any).mode, 'travel') as SceneMode) || 'travel';
    onChange(ensureModeShape(structuredClone(init) as any, mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, onChange]);

  const value = (isPlainObject(data) ? data : {}) as any as SceneData;

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const err = (path: string) => issueMap.get(path)?.message;

  const sceneModes = (config?.sceneModes ?? ['travel', 'rest', 'combat']) as SceneMode[];
  const combatPhases = (config?.combatPhases ?? ['turn', 'melee', 'ranged', 'other']) as CombatPhase[];

  const mode = (asStr((value as any).mode, 'travel') as SceneMode) || 'travel';

  const setScene = (patch: any) => {
    onChange({ ...(structuredClone(value) as any), ...(patch ?? {}) });
  };

  // combat helpers
  const combat = isPlainObject((value as any).combat) ? ((value as any).combat as any) : null;
  const order = uniqStr(combat?.initiativeOrder);

  const [newId, setNewId] = useState('');

  const addToOrder = () => {
    const id = newId.trim();
    if (!id) return;
    const nextOrder = uniqStr([...(order ?? []), id]);
    const next = ensureModeShape(structuredClone(value ?? {}) as any, 'combat');
    next.combat.initiativeOrder = nextOrder;
    if (next.combat.activeIndex >= nextOrder.length) next.combat.activeIndex = 0;
    onChange(next);
    setNewId('');
  };

  const removeFromOrder = (idx: number) => {
    const nextOrder = order.filter((_, i) => i !== idx);
    const next = ensureModeShape(structuredClone(value ?? {}) as any, 'combat');
    next.combat.initiativeOrder = nextOrder;
    if (next.combat.activeIndex >= nextOrder.length) next.combat.activeIndex = 0;
    onChange(next);
  };

  const moveOrder = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const nextOrder = [...order];
    const tmp = nextOrder[idx];
    nextOrder[idx] = nextOrder[j];
    nextOrder[j] = tmp;

    const next = ensureModeShape(structuredClone(value ?? {}) as any, 'combat');
    next.combat.initiativeOrder = nextOrder;
    onChange(next);
  };

  const setActiveIndex = (idx: number) => {
    const next = ensureModeShape(structuredClone(value ?? {}) as any, 'combat');
    next.combat.activeIndex = idx;
    onChange(next);
  };

  // contacts editor (simple pair add)
  const [cA, setCA] = useState('');
  const [cB, setCB] = useState('');

  const contacts: Array<[string, string]> = Array.isArray(combat?.contacts) ? combat.contacts : [];

  const addContact = () => {
    const a = cA.trim();
    const b = cB.trim();
    if (!a || !b || a === b) return;

    const x = a < b ? a : b;
    const y = a < b ? b : a;

    const next = ensureModeShape(structuredClone(value ?? {}) as any, 'combat');
    next.combat.contacts = [...(next.combat.contacts ?? []), [x, y]];
    onChange(next);
    setCA('');
    setCB('');
  };

  const removeContact = (idx: number) => {
    const next = ensureModeShape(structuredClone(value ?? {}) as any, 'combat');
    next.combat.contacts = (Array.isArray(next.combat.contacts) ? next.combat.contacts : []).filter((_: any, i: number) => i !== idx);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* MODE */}
      <div className="grid gap-2">
        <div className="text-sm text-white/80">Режим сцены</div>
        <select
          className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm"
          value={mode}
          onChange={(e) => {
            const nextMode = e.target.value as SceneMode;
            const next = ensureModeShape(structuredClone(value ?? {}) as any, nextMode);
            onChange(next);
          }}
        >
          {sceneModes.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        {err('mode') ? <div className="text-xs text-red-400">{err('mode')}</div> : null}
      </div>

      {/* TRAVEL */}
      {mode === 'travel' ? (
        <div className="grid gap-2">
          <div className="text-sm text-white/80">Путешествие</div>
          <div className="grid gap-2">
            <div className="text-xs text-white/60">Темп</div>
            <select
              className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm"
              value={asStr((value as any).travel?.pace, 'normal')}
              onChange={(e) => {
                const next = ensureModeShape(structuredClone(value ?? {}) as any, 'travel');
                next.travel.pace = e.target.value;
                onChange(next);
              }}
            >
              {['slow', 'normal', 'fast'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {/* REST */}
      {mode === 'rest' ? (
        <div className="grid gap-2">
          <div className="text-sm text-white/80">Отдых</div>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={Boolean((value as any).rest?.camp)}
              onChange={(e) => {
                const next = ensureModeShape(structuredClone(value ?? {}) as any, 'rest');
                next.rest.camp = e.target.checked;
                onChange(next);
              }}
            />
            Лагерь разбит
          </label>
        </div>
      ) : null}

      {/* COMBAT */}
      {mode === 'combat' ? (
        <div className="space-y-4">
          <div className="grid gap-2">
            <div className="text-sm text-white/80">Бой</div>

            <div className="grid gap-2">
              <div className="text-xs text-white/60">Фаза</div>
              <select
                className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm"
                value={asStr(combat?.phase, 'turn')}
                onChange={(e) => {
                  const next = ensureModeShape(structuredClone(value ?? {}) as any, 'combat');
                  next.combat.phase = e.target.value;
                  onChange(next);
                }}
              >
                {combatPhases.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {err('combat.phase') ? <div className="text-xs text-red-400">{err('combat.phase')}</div> : null}
            </div>
          </div>

          {/* initiative order */}
          <div className="grid gap-2">
            <div className="text-sm text-white/80">Инициатива (order)</div>

            <div className="flex gap-2 items-center">
              <Input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="uuid (id персонажа/нпс)…"
              />
              <button
                className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10"
                type="button"
                onClick={addToOrder}
              >
                + add
              </button>
            </div>

            {order.length ? (
              <div className="space-y-2">
                {order.map((id, idx) => (
                  <div key={`${id}:${idx}`} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <button
                      className="text-xs text-white/70 hover:text-white"
                      type="button"
                      onClick={() => moveOrder(idx, -1)}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      className="text-xs text-white/70 hover:text-white"
                      type="button"
                      onClick={() => moveOrder(idx, 1)}
                      disabled={idx === order.length - 1}
                    >
                      ↓
                    </button>

                    <div className="text-sm text-white/80">{id}</div>

                    <button
                      className="ml-auto text-xs text-white/70 hover:text-white"
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      disabled={idx === Number(combat?.activeIndex ?? 0)}
                    >
                      set active
                    </button>

                    <button
                      className="text-xs text-red-300 hover:text-red-200"
                      type="button"
                      onClick={() => removeFromOrder(idx)}
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-white/50">Пусто: добавь участников боя по id.</div>
            )}

            {err('combat.initiativeOrder') ? <div className="text-xs text-red-400">{err('combat.initiativeOrder')}</div> : null}
            {err('combat.activeIndex') ? <div className="text-xs text-red-400">{err('combat.activeIndex')}</div> : null}
          </div>

          {/* contacts */}
          <div className="grid gap-2">
            <div className="text-sm text-white/80">Контакты (после turn)</div>

            <div className="flex gap-2 items-center">
              <Input value={cA} onChange={(e) => setCA(e.target.value)} placeholder="id A" />
              <Input value={cB} onChange={(e) => setCB(e.target.value)} placeholder="id B" />
              <button
                className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10"
                type="button"
                onClick={addContact}
              >
                + add
              </button>
            </div>

            {contacts.length ? (
              <div className="space-y-2">
                {contacts.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-sm text-white/80">{p?.[0]} ↔ {p?.[1]}</div>
                    <button
                      className="ml-auto text-xs text-red-300 hover:text-red-200"
                      type="button"
                      onClick={() => removeContact(idx)}
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-white/50">Пока нет контактов.</div>
            )}

            {err('combat.contacts') ? <div className="text-xs text-red-400">{err('combat.contacts')}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
