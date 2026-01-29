'use client';

import { useMemo } from 'react';
import { CharacterConfig, ActionId, AttributeId, TraumaId } from '../types';

type Props = {
  data: Record<string, any>;
  config?: CharacterConfig;
};

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

function harmCell(x: any) {
  const s = typeof x === 'string' ? x.trim() : '';
  return s.length ? s : '—';
}

export default function CharacterDataView({ data, config }: Props) {
  const value = (data ?? {}) as any;
  const actions: Partial<Record<ActionId, number>> = (value.actions ?? {}) as any;

  const actionToAttr = useMemo(() => {
    const m = new Map<ActionId, AttributeId>();
    for (const a of config?.actions ?? []) m.set(a.id, a.attribute);
    return m;
  }, [config?.actions]);

  const attrs = useMemo(() => computeAttributesFromActions(actions, actionToAttr), [actions, actionToAttr]);

  if (!config) {
    return <pre className="text-xs">{JSON.stringify(data ?? {}, null, 2)}</pre>;
  }

  const actionsByAttr: Record<AttributeId, { id: ActionId; title: string; attribute: AttributeId }[]> = {
    insight: [],
    prowess: [],
    resolve: [],
  };
  for (const a of config.actions ?? []) actionsByAttr[a.attribute].push(a);

  const traumas: TraumaId[] = Array.isArray(value.traumas) ? value.traumas : [];
  const traumaTitles = new Map((config.traumas ?? []).map((t) => [t.id, t.title]));

  const harm = value.harm ?? {};
  const l1 = Array.isArray(harm.l1) ? harm.l1 : [];
  const l2 = Array.isArray(harm.l2) ? harm.l2 : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm">
        <span className="text-muted-foreground">Stress:</span> {value.stress ?? 0}
        {'  '}|{' '}
        <span className="text-muted-foreground">Load:</span> {value.load ?? '—'}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(['insight', 'prowess', 'resolve'] as AttributeId[]).map((aid) => (
          <div key={aid} className="rounded border p-3">
            <div className="font-medium">{config.attributes?.find((x) => x.id === aid)?.title ?? aid}</div>
            <div className="text-xs text-muted-foreground">Атрибут (resistance): {attrs[aid]}</div>

            <div className="mt-2 flex flex-col gap-1">
              {(actionsByAttr[aid] ?? []).map((a) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span>{a.title}</span>
                  <span>{Number(actions?.[a.id] ?? 0) || 0}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded border p-3">
        <div className="font-medium">Traumas</div>
        <div className="text-sm mt-2">
          {traumas.length ? traumas.map((t) => traumaTitles.get(t) ?? t).join(', ') : '—'}
        </div>
      </div>

      <div className="rounded border p-3">
        <div className="font-medium">Harm</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Level 1</div>
            <div>{harmCell(l1[0])}</div>
            <div>{harmCell(l1[1])}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Level 2</div>
            <div>{harmCell(l2[0])}</div>
            <div>{harmCell(l2[1])}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Level 3</div>
            <div>{harmCell(harm.l3)}</div>
          </div>
        </div>
      </div>

      <pre className="text-xs mt-2">{JSON.stringify(data ?? {}, null, 2)}</pre>
    </div>
  );
}
