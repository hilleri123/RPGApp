'use client';

import { useMemo } from 'react';
import type { CharacterConfig, ActionId, AttributeId, TraumaId, PlaybookId, LoadId } from '../types';
import { ATTR_RU, ACTION_RU, TRAUMA_RU } from '../i18n';
import { ACTION_GROUPS } from '../types'; // поправь путь если ACTION_GROUPS в другом модуле

type Props = {
  data: Record<string, any>;
  config?: CharacterConfig;
};

function computeAttributesFromActions(
  actions: Partial<Record<ActionId, number>>,
  actionToAttr: Map<ActionId, AttributeId>,
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

const pillBase =
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-white/10 bg-white/5 text-white/90';

export default function CharacterDataView({ data, config }: Props) {
  const value = (data ?? {}) as any;
  const actions: Partial<Record<ActionId, number>> = (value.actions ?? {}) as any;

  // цвета по атрибутам (из ACTION_GROUPS)
  const attrColor = useMemo(() => {
    const m = new Map<AttributeId, string>();
    for (const g of ACTION_GROUPS) m.set(g.key, g.color);
    return (id: AttributeId) => m.get(id) ?? '#94a3b8';
  }, []);

  const actionToAttr = useMemo(() => {
    const m = new Map<ActionId, AttributeId>();
    for (const a of config?.actions ?? []) m.set(a.id, a.attribute);
    return m;
  }, [config?.actions]);

  const attrs = useMemo(() => computeAttributesFromActions(actions, actionToAttr), [actions, actionToAttr]);

  const actionsByAttr = useMemo(() => {
    const res: Record<AttributeId, { id: ActionId; title: string; attribute: AttributeId }[]> = {
      insight: [],
      prowess: [],
      resolve: [],
    };
    for (const a of config?.actions ?? []) res[a.attribute].push(a);
    return res;
  }, [config?.actions]);

  const traumas: TraumaId[] = Array.isArray(value.traumas) ? value.traumas : [];
  const traumaTitles = useMemo(
    () => new Map((config?.traumas ?? []).map((t) => [t.id, t.title])),
    [config?.traumas],
  );

  const traumaLabel = (id: TraumaId) => {
    const ru = TRAUMA_RU[id];
    return ru?.name ?? traumaTitles.get(id) ?? String(id);
  };

  const traumaDesc = (id: TraumaId) => {
    const ru = TRAUMA_RU[id];
    return ru?.desc ?? '';
  };


  const harm = value.harm ?? {};
  const l1 = Array.isArray(harm.l1) ? harm.l1 : [];
  const l2 = Array.isArray(harm.l2) ? harm.l2 : [];

  const playbookId: PlaybookId | null = (value.playbookId ?? null) as any;

  const playbook = useMemo(
    () => (config?.playbooks ?? []).find((p) => p.id === playbookId) ?? null,
    [config?.playbooks, playbookId],
  );

  const selectedAbilities: string[] = Array.isArray(value.abilities) ? value.abilities : [];

  const startingActions = useMemo(() => toStartingMap(playbook?.startingActions), [playbook?.startingActions]);

  const manualSpent = useMemo(() => {
    if (!config?.actions?.length) return 0;
    let total = 0;
    for (const a of config.actions ?? []) {
      const cur = Number(actions?.[a.id] ?? 0) || 0;
      const def = Number(startingActions?.[a.id] ?? 0) || 0;
      total += Math.max(0, cur - def);
    }
    return total;
  }, [actions, startingActions, config?.actions]);

  const totalSpent = useMemo(() => {
    if (!config?.actions?.length) {
      let total = 0;
      for (const v of Object.values(actions ?? {})) total += Number(v) || 0;
      return total;
    }
    let total = 0;
    for (const a of config.actions ?? []) total += Number(actions?.[a.id] ?? 0) || 0;
    return total;
  }, [actions, config?.actions]);

  const defaultsByAttr = useMemo(() => {
    const res: Record<AttributeId, Array<{ id: ActionId; dots: number }>> = {
      insight: [],
      prowess: [],
      resolve: [],
    };

    for (const [k, v] of Object.entries(startingActions ?? {})) {
      const aid = k as ActionId;
      const dots = Number(v);
      if (!aid) continue;
      if (!Number.isFinite(dots)) continue;
      const attr = actionToAttr.get(aid);
      if (!attr) continue;
      res[attr].push({ id: aid, dots });
    }

    for (const key of Object.keys(res) as AttributeId[]) res[key].sort((a, b) => a.id.localeCompare(b.id));
    return res;
  }, [startingActions, actionToAttr]);

  const defaultTooltipAttr = (attr: AttributeId) => {
    const rows = defaultsByAttr[attr] ?? [];
    if (!rows.length) return '';
    const pretty = rows.map((x) => `${ACTION_RU[x.id] ?? x.id}: ${x.dots}`).join(', ');
    return `Значения по умолчанию: ${pretty}`;
  };

  const stress = Number(value.stress ?? 0) || 0;
  const load: LoadId | null = (value.load ?? null) as any;

  const loadBadge = (x: LoadId | null) => {
    if (!x) return '—';
    if (x === 'light') return 'Light';
    if (x === 'normal') return 'Normal';
    if (x === 'heavy') return 'Heavy';
    return String(x);
  };

  // после всех хуков можно условно вернуть
  if (!config) {
    return <pre className="text-xs text-white">{JSON.stringify(data ?? {}, null, 2)}</pre>;
  }

  return (
    <div className="flex text-white flex-col gap-3">
      {/* Header */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={pillBase}>
            Плейбук: <span className="ml-1 text-white">{playbook ? playbook.title : playbookId ?? '—'}</span>
          </span>
          <span className={pillBase}>
            Stress: <span className="ml-1 text-white">{stress}</span>
          </span>
          <span className={pillBase}>
            Load: <span className="ml-1 text-white">{loadBadge(load)}</span>
          </span>

          {playbook ? (
            <span className={`${pillBase} border-white/15`}>
              Default actions включены
            </span>
          ) : null}
        </div>

        <div className="mt-2 text-xs text-white/60">
          {playbook
            ? 'Подсветка: (def) — стартовые точки плейбука; “Потрачено вручную” считается поверх них.'
            : 'Плейбук не выбран — считаем только текущие значения.'}
        </div>
      </div>

      {/* Abilities */}
      {playbook ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Способности</div>
            <span className={pillBase}>Выбрано: {selectedAbilities.length}</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {selectedAbilities.length ? (
              selectedAbilities.map((id) => (
                <span key={id} className={pillBase}>
                  {id}
                </span>
              ))
            ) : (
              <span className="text-sm text-white/60">—</span>
            )}
          </div>

          {Array.isArray(playbook.abilities) && playbook.abilities.length ? (
            <div className="mt-3 grid grid-cols-1 gap-2">
              {playbook.abilities
                .filter((a) => selectedAbilities.includes(a.id))
                .map((a) => (
                  <div key={a.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-sm font-medium">{a.title}</div>
                    {a.description ? <div className="text-xs text-white/60 mt-1">{a.description}</div> : null}
                  </div>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Actions */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">Навыки (actions)</div>
          {playbook ? (
            <span
              className={pillBase}
              title="Ручные очки = сумма max(0, текущее - значение по умолчанию плейбука)."
            >
              Вручную: {manualSpent} • Всего: {totalSpent}
            </span>
          ) : (
            <span className={pillBase}>Всего: {totalSpent}</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          {(['insight', 'prowess', 'resolve'] as AttributeId[]).map((aid) => {
            const color = attrColor(aid);
            const hasDefaults = playbook ? (defaultsByAttr[aid] ?? []).length > 0 : false;

            return (
              <div key={aid} className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                <div className="h-1" style={{ backgroundColor: color }} />
                <div className="p-3" title={hasDefaults ? defaultTooltipAttr(aid) : undefined}>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-medium">{ATTR_RU[aid] ?? aid}</div>
                    <span className={pillBase} style={{ borderColor: `${color}55` }}>
                      Resistance: {attrs[aid]}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-1">
                    {(actionsByAttr[aid] ?? []).map((a) => {
                      const cur = Number(actions?.[a.id] ?? 0) || 0;
                      const def = Number(startingActions?.[a.id] ?? 0) || 0;
                      const isDefaultAction = def > 0;

                      return (
                        <div
                          key={a.id}
                          className={`flex items-center justify-between rounded-md px-2 py-1 text-sm border ${
                            isDefaultAction ? 'border-white/10 bg-white/5' : 'border-transparent'
                          }`}
                          title={isDefaultAction ? `Default: ${def}` : undefined}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: color, opacity: isDefaultAction ? 1 : 0.5 }}
                            />
                            <span className="truncate">
                              {ACTION_RU[a.id] ?? a.title}
                              {isDefaultAction ? <span className="text-xs text-white/60"> (def {def})</span> : null}
                            </span>
                          </div>

                          <span className={pillBase}>{cur}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Traumas */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Травмы</div>
          <span className={pillBase}>Счёт: {traumas.length}</span>
        </div>

        {traumas.length ? (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {traumas.map((t) => {
              const title = traumaLabel(t);
              const desc = traumaDesc(t);

              return (
                <div
                  key={t}
                  className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2"
                  title={desc || undefined}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-sm font-medium">{title}</div>
                    <span className="text-xs text-white/60">{t}</span>
                  </div>
                  {desc ? <div className="text-xs text-white/60 mt-1">{desc}</div> : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 text-sm text-white/60">—</div>
        )}
      </div>


      {/* Harm */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="font-medium">Ранения (Harm)</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 text-sm">
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-xs text-white/60 mb-1">Уровень 1</div>
            <div>{harmCell(l1[0])}</div>
            <div>{harmCell(l1[1])}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-xs text-white/60 mb-1">Уровень 2</div>
            <div>{harmCell(l2[0])}</div>
            <div>{harmCell(l2[1])}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-xs text-white/60 mb-1">Уровень 3</div>
            <div>{harmCell(harm.l3)}</div>
          </div>
        </div>
      </div>

      {/* Items (raw) */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="font-medium">Предметы (items)</div>
        <div className="text-sm mt-2">
          {Array.isArray(value.items) && value.items.length ? (
            <pre className="text-xs whitespace-pre-wrap text-white/80">{JSON.stringify(value.items, null, 2)}</pre>
          ) : (
            <span className="text-white/60">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
