'use client';

import { useEffect, useMemo } from 'react';

import { Input } from '@/components/ui/input';

import {
  ValidationIssue,
  CharacterConfig,
  ActionId,
  AttributeId,
  TraumaId,
  LoadId,
  PlaybookId,
} from '../types';

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

function computeAttributesFromActions(
  actions: Partial<Record<ActionId, number>>,
  actionToAttr: Map<ActionId, AttributeId>
) {
  const res: Record<AttributeId, number> = { insight: 0, prowess: 0, resolve: 0 };
  for (const [aid, v] of Object.entries(actions ?? {}) as any) {
    const attr = actionToAttr.get(aid as ActionId);
    if (!attr) continue;
    if ((Number(v) || 0) > 0) res[attr] += 1;
  }
  return res;
}

function ensureHarmShape(x: any) {
  const harm = isPlainObject(x) ? x : {};
  const l1 = Array.isArray(harm.l1) ? harm.l1.slice(0, 2) : [];
  const l2 = Array.isArray(harm.l2) ? harm.l2.slice(0, 2) : [];
  return {
    l3: typeof harm.l3 === 'string' ? harm.l3 : (harm.l3 ?? null),
    l2: [l2[0] ?? null, l2[1] ?? null] as [string | null, string | null],
    l1: [l1[0] ?? null, l1[1] ?? null] as [string | null, string | null],
  };
}

export default function CharacterDataEditor({ data, config, issues, onChange }: Props) {
  useEffect(() => {
    const hasObject = isPlainObject(data);
    if (!hasObject && config?.initialData) {
      onChange(structuredClone(config.initialData) as any);
      return;
    }

    const next: any = structuredClone(hasObject ? data : {});
    let changed = false;

    if (!isPlainObject(next.actions)) {
      next.actions = structuredClone((config.initialData as any).actions ?? {});
      changed = true;
    }

    if (!Array.isArray(next.traumas)) {
      next.traumas = structuredClone((config.initialData as any).traumas ?? []);
      changed = true;
    }

    // playbook + abilities init
    if (next.playbookId === undefined) {
      next.playbookId = (config.initialData as any).playbookId ?? null;
      changed = true;
    }

    if (!Array.isArray(next.abilities)) {
      next.abilities = structuredClone((config.initialData as any).abilities ?? []);
      changed = true;
    }

    if (!isPlainObject(next.harm)) {
      next.harm = structuredClone(
        (config.initialData as any).harm ?? { l3: null, l2: [null, null], l1: [null, null] }
      );
      changed = true;
    } else {
      const fixed = ensureHarmShape(next.harm);
      if (JSON.stringify(fixed) !== JSON.stringify(next.harm)) {
        next.harm = fixed;
        changed = true;
      }
    }

    if (next.load === undefined) {
      next.load = (config.initialData as any).load ?? null;
      changed = true;
    }

    if (next.stress === undefined) {
      next.stress = (config.initialData as any).stress ?? 0;
      changed = true;
    }

    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const err = (path: string) => issueMap.get(path)?.message;

  const value = (isPlainObject(data) ? data : {}) as any;
  const actions: Partial<Record<ActionId, number>> = (value.actions ?? {}) as any;
  const harm = ensureHarmShape(value.harm);

  const actionToAttr = useMemo(() => {
    const m = new Map<ActionId, AttributeId>();
    for (const a of config.actions ?? []) m.set(a.id, a.attribute);
    return m;
  }, [config.actions]);

  const attrs = useMemo(() => computeAttributesFromActions(actions, actionToAttr), [actions, actionToAttr]);

  const setPatch = (patch: Record<string, any>) => {
    onChange({ ...(structuredClone(value) as any), ...(patch as any) });
  };

  const setAction = (actionId: ActionId, rating: number) => {
    const next = structuredClone(value ?? {}) as any;
    next.actions = next.actions ?? {};
    next.actions[actionId] = Math.max(0, Math.floor(rating));
    onChange(next);
  };

  const actionsByAttr = useMemo(() => {
    const acc: Record<AttributeId, { id: ActionId; title: string; attribute: AttributeId }[]> = {
      insight: [],
      prowess: [],
      resolve: [],
    };
    for (const a of config.actions ?? []) acc[a.attribute].push(a);
    return acc;
  }, [config.actions]);

  const traumaMax = Number(config?.constraints?.traumaMax ?? 4);

  const selectedTraumas: TraumaId[] = Array.isArray(value.traumas) ? value.traumas : [];
  const toggleTrauma = (tid: TraumaId) => {
    const cur = new Set<TraumaId>(selectedTraumas);
    if (cur.has(tid)) cur.delete(tid);
    else {
      if (cur.size >= traumaMax) return;
      cur.add(tid);
    }
    setPatch({ traumas: Array.from(cur) });
  };

  // playbook + abilities UI state
  const playbookId: PlaybookId | null = (value.playbookId ?? null) as any;
  const abilitiesMax = Number(config?.constraints?.abilitiesMaxAtStart ?? 1);

  const playbook = (config.playbooks ?? []).find((p) => p.id === playbookId) ?? null;
  const selectedAbilities: string[] = Array.isArray(value.abilities) ? value.abilities : [];

  const toggleAbility = (aid: string) => {
    const cur = new Set<string>(selectedAbilities);
    if (cur.has(aid)) cur.delete(aid);
    else {
      if (cur.size >= abilitiesMax) return;
      cur.add(aid);
    }
    setPatch({ abilities: Array.from(cur) });
  };

  const setPlaybook = (pid: PlaybookId | null) => {
    // при смене плейбука сбрасываем способности, чтобы не словить "не из этого плейбука"
    setPatch({ playbookId: pid, abilities: [] });
  };

  const setHarmCell = (level: 'l1' | 'l2' | 'l3', idx: number | null, text: string) => {
    const next = structuredClone(value ?? {}) as any;
    next.harm = ensureHarmShape(next.harm);
    const v = text.trim();
    const cell = v.length ? v : null;

    if (level === 'l3') next.harm.l3 = cell;
    if (level === 'l2' && idx != null) next.harm.l2[idx] = cell;
    if (level === 'l1' && idx != null) next.harm.l1[idx] = cell;

    onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Playbook / Abilities */}
      <div className="rounded border p-3">
        <div className="font-medium">Плейбук</div>

        <div className="mt-2">
          <select
            className={
              err('playbookId')
                ? 'w-full border border-red-500 rounded px-3 py-2 text-sm text-black bg-background'
                : 'w-full border rounded px-3 py-2 text-sm text-black bg-background'
            }
            value={(playbookId ?? '') as any}
            onChange={(e) => setPlaybook(e.target.value ? (e.target.value as PlaybookId) : null)}
          >
            <option value="">—</option>
            {(config.playbooks ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {err('playbookId') ? <div className="text-xs text-red-500 mt-1">{err('playbookId')}</div> : null}
        </div>

        <div className="mt-4">
          <div className="text-sm text-muted-foreground">
            Способности ({selectedAbilities.length}/{abilitiesMax})
          </div>

          {playbook ? (
            <div className="flex flex-col gap-2 mt-2">
              {(playbook.abilities ?? []).map((a) => {
                const checked = selectedAbilities.includes(a.id);
                const disabled = !checked && selectedAbilities.length >= abilitiesMax;

                return (
                  <label
                    key={a.id}
                    className={`rounded border px-2 py-2 text-sm cursor-pointer ${checked ? 'bg-muted' : ''} ${
                      disabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleAbility(a.id)}
                    />
                    <span className="font-medium">{a.title}</span>
                    {a.description ? <div className="text-xs text-muted-foreground mt-1">{a.description}</div> : null}
                  </label>
                );
              })}

              {err('abilities') ? <div className="text-xs text-red-500 mt-1">{err('abilities')}</div> : null}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground mt-2">Сначала выбери плейбук.</div>
          )}
        </div>
      </div>

      {/* ACTIONS grouped by attributes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(['insight', 'prowess', 'resolve'] as AttributeId[]).map((aid) => (
          <div key={aid} className="rounded border p-3">
            <div className="font-medium">{config.attributes?.find((x) => x.id === aid)?.title ?? aid}</div>
            <div className="text-xs text-muted-foreground">Атрибут (для resistance): {attrs[aid]}</div>

            <div className="mt-3 flex flex-col gap-2">
              {(actionsByAttr[aid] ?? []).map((a) => {
                const v = Number(actions?.[a.id] ?? 0) || 0;
                const msg = err(`actions.${a.id}`);
                return (
                  <div key={a.id} className="flex items-center gap-2">
                    <div className="w-28 text-sm">{a.title}</div>
                    <Input
                      type="number"
                      value={v}
                      onChange={(e) => setAction(a.id, asNumber(e.target.value, 0))}
                      className={msg ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
                    />
                    {msg ? <div className="text-xs text-red-500">{msg}</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Stress / Load */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Stress</div>
          <Input
            type="number"
            value={value.stress ?? 0}
            onChange={(e) => setPatch({ stress: Math.max(0, asNumber(e.target.value, 0)) })}
            className={err('stress') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
          />
        </div>

        <div>
          <div className="text-sm text-muted-foreground">Load</div>
          <select
            className="w-full text-black border rounded px-3 py-2 text-sm bg-background"
            value={(value.load ?? '') as any}
            onChange={(e) => setPatch({ load: e.target.value ? (e.target.value as LoadId) : null })}
          >
            <option value="">—</option>
            {(config.loads ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} ({l.value})
              </option>
            ))}
          </select>
          {err('load') ? <div className="text-xs text-red-500 mt-1">{err('load')}</div> : null}
        </div>

        <div>
          <div className="text-sm text-muted-foreground">
            Traumas ({selectedTraumas.length}/{traumaMax})
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {(config.traumas ?? []).map((t) => {
              const checked = selectedTraumas.includes(t.id);
              const disabled = !checked && selectedTraumas.length >= traumaMax;
              return (
                <label
                  key={t.id}
                  className={`text-xs px-2 py-1 rounded border cursor-pointer ${checked ? 'bg-muted' : ''} ${
                    disabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleTrauma(t.id)}
                  />
                  {t.title}
                </label>
              );
            })}
          </div>
          {err('traumas') ? <div className="text-xs text-red-500 mt-1">{err('traumas')}</div> : null}
        </div>
      </div>

      {/* Harm 2/2/1 */}
      <div className="rounded border p-3">
        <div className="font-medium">Harm</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div>
            <div className="text-sm text-muted-foreground">Level 1 (2)</div>
            <div className="flex flex-col gap-2">
              {[0, 1].map((i) => (
                <Input
                  key={i}
                  value={harm.l1?.[i] ?? ''}
                  onChange={(e) => setHarmCell('l1', i, e.target.value)}
                  className={err('harm.l1') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Level 2 (2)</div>
            <div className="flex flex-col gap-2">
              {[0, 1].map((i) => (
                <Input
                  key={i}
                  value={harm.l2?.[i] ?? ''}
                  onChange={(e) => setHarmCell('l2', i, e.target.value)}
                  className={err('harm.l2') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Level 3 (1)</div>
            <Input
              value={harm.l3 ?? ''}
              onChange={(e) => setHarmCell('l3', null, e.target.value)}
              className={err('harm.l3') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Items редактируются отдельно как сущности item; здесь можно хранить ссылки/встроенные записи.
      </div>
    </div>
  );
}
