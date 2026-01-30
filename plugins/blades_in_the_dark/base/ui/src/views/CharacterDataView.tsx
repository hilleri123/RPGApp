'use client';

import { useMemo } from 'react';
import type { CharacterConfig, ActionId, AttributeId, TraumaId, LoadId, PlaybookId } from '../types';

import { ATTR_RU, ACTION_RU } from '../i18n';

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

function toStartingMap(x: any): Partial<Record<ActionId, number>> {
  const res: Partial<Record<ActionId, number>> = {};
  if (!x || typeof x !== 'object') return res;
  for (const [k, v] of Object.entries(x)) {
    if (!k) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    res[k as ActionId] = Math.max(0, Math.floor(n));
  }
  return res;
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

  // --- playbook + abilities (если config.playbooks реально есть) ---
  const playbookId: PlaybookId | null = (value.playbookId ?? null) as any;
  const playbook =
    (config.playbooks ?? []).find((p) => p.id === playbookId) ?? null;

  const selectedAbilities: string[] = Array.isArray(value.abilities) ? value.abilities : [];
  const startingActions = useMemo(() => toStartingMap(playbook?.startingActions), [playbook]);

  const manualSpent = useMemo(() => {
    let total = 0;
    for (const a of config.actions ?? []) {
      const cur = Number(actions?.[a.id] ?? 0) || 0;
      const def = Number(startingActions?.[a.id] ?? 0) || 0;
      total += Math.max(0, cur - def);
    }
    return total;
  }, [actions, startingActions, config.actions]);

  const totalSpent = useMemo(() => {
    let total = 0;
    for (const a of config.actions ?? []) total += Number(actions?.[a.id] ?? 0) || 0;
    return total;
  }, [actions, config.actions]);

  const defaultsByAttr = useMemo(() => {
    const res: Record<AttributeId, Array<{ id: ActionId; dots: number }>> = {
      insight: [],
      prowess: [],
      resolve: [],
    };

    for (const [k, v] of Object.entries(startingActions)) {
      const aid = k as ActionId;
      const dots = Number(v);
      if (!aid) continue;
      if (!Number.isFinite(dots)) continue;
      const attr = actionToAttr.get(aid);
      if (!attr) continue;
      res[attr].push({ id: aid, dots });
    }

    for (const key of Object.keys(res) as AttributeId[]) {
      res[key].sort((a, b) => a.id.localeCompare(b.id));
    }

    return res;
  }, [startingActions, actionToAttr]);

  const defaultTooltipAttr = (attr: AttributeId) => {
    const rows = defaultsByAttr[attr] ?? [];
    if (!rows.length) return '';
    const pretty = rows.map((x) => `${ACTION_RU[x.id] ?? x.id}: ${x.dots}`).join(', ');
    return `Значения по умолчанию: ${pretty}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header: playbook / stress / load */}
      <div className="rounded border p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Плейбук:</span>{' '}
            {playbook ? playbook.title : (playbookId ?? '—')}
          </div>
          <div>
            <span className="text-muted-foreground">Stress:</span> {value.stress ?? 0}
          </div>
          <div>
            <span className="text-muted-foreground">Load:</span> {value.load ?? '—'}
          </div>
        </div>

        {playbook ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Стартовые навыки плейбука применены (если есть); выбранные способности ниже.
          </div>
        ) : null}
      </div>

      {/* Abilities */}
      {playbook ? (
        <div className="rounded border p-3">
          <div className="font-medium">Способности</div>
          <div className="text-sm mt-2">
            {selectedAbilities.length ? selectedAbilities.join(', ') : '—'}
          </div>

          {Array.isArray(playbook.abilities) && playbook.abilities.length ? (
            <div className="mt-3 flex flex-col gap-2">
              {playbook.abilities
                .filter((a) => selectedAbilities.includes(a.id))
                .map((a) => (
                  <div key={a.id} className="rounded border px-2 py-2">
                    <div className="text-sm font-medium">{a.title}</div>
                    {a.description ? <div className="text-xs text-muted-foreground mt-1">{a.description}</div> : null}
                  </div>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Actions summary + actions */}
      <div className="rounded border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">Навыки (actions)</div>
          {playbook ? (
            <div
              className="text-xs text-muted-foreground"
              title="Ручные очки = сумма max(0, текущее - значение по умолчанию плейбука)."
            >
              Потрачено вручную: {manualSpent} | Всего: {totalSpent}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Всего: {totalSpent}</div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          {(['insight', 'prowess', 'resolve'] as AttributeId[]).map((aid) => {
            const hasDefaults = playbook ? (defaultsByAttr[aid] ?? []).length > 0 : false;
            const tooltip = playbook ? defaultTooltipAttr(aid) : '';

            return (
              <div
                key={aid}
                className={`rounded border p-3 ${hasDefaults ? 'bg-muted/40' : ''}`}
                title={tooltip || undefined}
              >
                <div className="font-medium">{ATTR_RU[aid] ?? aid}</div>
                <div className="text-xs text-muted-foreground">Атрибут (resistance): {attrs[aid]}</div>

                <div className="mt-2 flex flex-col gap-1">
                  {(actionsByAttr[aid] ?? []).map((a) => {
                    const cur = Number(actions?.[a.id] ?? 0) || 0;
                    const def = Number(startingActions?.[a.id] ?? 0) || 0;
                    const isDefaultAction = def > 0;

                    return (
                      <div
                        key={a.id}
                        className={`flex justify-between text-sm rounded px-1 py-1 ${isDefaultAction ? 'bg-muted/60' : ''}`}
                        title={isDefaultAction ? `Значение по умолчанию: ${ACTION_RU[a.id] ?? a.id} = ${def}` : undefined}
                      >
                        <span>
                          {ACTION_RU[a.id] ?? a.title}
                          {isDefaultAction ? <span className="text-xs text-muted-foreground"> (def {def})</span> : null}
                        </span>
                        <span>{cur}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Traumas */}
      <div className="rounded border p-3">
        <div className="font-medium">Травмы</div>
        <div className="text-sm mt-2">
          {traumas.length ? traumas.map((t) => traumaTitles.get(t) ?? t).join(', ') : '—'}
        </div>
      </div>

      {/* Harm */}
      <div className="rounded border p-3">
        <div className="font-medium">Ранения (Harm)</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Уровень 1</div>
            <div>{harmCell(l1[0])}</div>
            <div>{harmCell(l1[1])}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Уровень 2</div>
            <div>{harmCell(l2[0])}</div>
            <div>{harmCell(l2[1])}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Уровень 3</div>
            <div>{harmCell(harm.l3)}</div>
          </div>
        </div>
      </div>

      {/* Items (если есть) */}
      <div className="rounded border p-3">
        <div className="font-medium">Предметы (items)</div>
        <div className="text-sm mt-2">
          {Array.isArray(value.items) && value.items.length ? (
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(value.items, null, 2)}</pre>
          ) : (
            '—'
          )}
        </div>
      </div>

      {/* Anything else in data */}
      <div className="rounded border p-3">
        <div className="font-medium">Доп. поля (raw)</div>
        <pre className="text-xs mt-2 whitespace-pre-wrap">{JSON.stringify(data ?? {}, null, 2)}</pre>
      </div>
    </div>
  );
}
