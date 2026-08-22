'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ResourceSpec } from '../types/pbta';
import type { ActiveResource, CharacterData } from '../types/character';
import { foResourceSum, listFoInstances } from '../types/character';

type Props = {
  data: CharacterData;
  resourceSpecs?: ResourceSpec[];
  editable?: boolean;
  onChange?: (next: CharacterData) => void;
};

function grantBucket(spec: ResourceSpec): 'resources' | 'temp_bonuses' {
  if (spec.kind === 'bonus' || spec.consume_on === 'roll') return 'temp_bonuses';
  return 'resources';
}

export function CharacterResourcesPanel({ data, resourceSpecs = [], editable = false, onChange }: Props) {
  const foSpecs = useMemo(
    () => resourceSpecs.filter((s) => s.id === 'forward' || s.id === 'ongoing'),
    [resourceSpecs],
  );
  const [grantSpec, setGrantSpec] = useState(foSpecs[0]?.id ?? 'forward');
  const [grantAmount, setGrantAmount] = useState(1);
  const [grantDescription, setGrantDescription] = useState('');

  useEffect(() => {
    if (!foSpecs.find((s) => s.id === grantSpec) && foSpecs.length > 0) {
      setGrantSpec(foSpecs[0].id);
    }
  }, [grantSpec, foSpecs]);

  const specMap = useMemo(() => new Map(foSpecs.map((s) => [s.id, s])), [foSpecs]);
  const instances = useMemo(() => listFoInstances(data), [data]);
  const sum = useMemo(() => foResourceSum(data), [data]);
  const tooltip = instances
    .map((i) => `${i.spec_id} ×${i.amount}${i.description ? ` — ${i.description}` : ''}`)
    .join('\n') || 'Нет forward / ongoing';

  const grantResource = () => {
    if (!editable || !onChange || !grantSpec || grantAmount <= 0) return;
    const spec = specMap.get(grantSpec);
    const bucket = spec ? grantBucket(spec) : 'temp_bonuses';
    const next = structuredClone(data);
    next.state = next.state ?? { resources: [], temp_bonuses: [] };
    const list = [...((next.state[bucket] as ActiveResource[] | undefined) ?? [])];
    list.push({
      id: `manual:${grantSpec}:${Date.now()}`,
      spec_id: grantSpec,
      amount: grantAmount,
      description: grantDescription.trim() || spec?.title || grantSpec,
    });
    next.state = { ...next.state, [bucket]: list };
    onChange(next);
    setGrantDescription('');
  };

  const removeResource = (id: string) => {
    if (!editable || !onChange) return;
    const next = structuredClone(data);
    next.state = next.state ?? {};
    for (const bucket of ['temp_bonuses', 'resources'] as const) {
      const list = [...((next.state[bucket] as ActiveResource[] | undefined) ?? [])];
      next.state[bucket] = list.filter((x) => x.id !== id);
    }
    onChange(next);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-gray-300" title={tooltip}>
        <span>Бонусы F+O</span>
        <span className="font-mono text-amber-200 text-base" title={tooltip}>
          Σ {sum}
        </span>
        <span className="text-[10px] text-gray-500">(наведи — список)</span>
      </div>

      {instances.length > 0 && (
        <ul className="space-y-1 text-sm">
          {instances.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded border border-white/10 px-2 py-1"
            >
              <span className="text-white/80">
                <span className="font-mono text-amber-200/90">{item.spec_id}</span>
                {' ×'}
                {item.amount}
                {item.description ? (
                  <span className="text-white/50"> — {item.description}</span>
                ) : null}
              </span>
              {editable && (
                <button
                  type="button"
                  className="text-xs text-red-300/80 hover:text-red-200"
                  onClick={() => removeResource(item.id)}
                >
                  убрать
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && foSpecs.length > 0 && (
        <div className="flex flex-wrap gap-2 items-end pt-1">
          <select
            className="rounded border bg-zinc-950/40 px-2 py-1 text-sm"
            value={grantSpec}
            onChange={(e) => setGrantSpec(e.target.value)}
          >
            {foSpecs.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            className="w-16 rounded border bg-zinc-950/40 px-2 py-1 text-sm"
            value={grantAmount}
            onChange={(e) => setGrantAmount(Number(e.target.value) || 1)}
          />
          <input
            className="flex-1 min-w-[8rem] rounded border bg-zinc-950/40 px-2 py-1 text-sm"
            placeholder="описание"
            value={grantDescription}
            onChange={(e) => setGrantDescription(e.target.value)}
          />
          <button
            type="button"
            className="rounded border border-amber-400/40 px-2 py-1 text-sm text-amber-100"
            onClick={grantResource}
          >
            + бонус
          </button>
        </div>
      )}
    </section>
  );
}
