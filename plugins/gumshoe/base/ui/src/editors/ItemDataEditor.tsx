'use client';

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ValidationIssue, ItemData } from '../types';

type Props = {
  data: Record<string, any>;
  config?: any;
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

export default function ItemDataEditor({ data, config, issues, onChange }: Props) {
  useEffect(() => {
    const hasObject = data && typeof data === 'object';
    const hasName = hasObject && typeof data.name === 'string';
    if (!hasName && config?.initialData) onChange(structuredClone(config.initialData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const value = (data ?? {}) as ItemData;

  const issueMap = useMemo(() => {
    const m = new Map<string, ValidationIssue>();
    for (const i of issues ?? []) m.set(normalizeIssuePath(i.path), i);
    return m;
  }, [issues]);

  const err = (path: string) => issueMap.get(path)?.message;

  const set = (patch: Partial<ItemData>) => {
    onChange({ ...(structuredClone(value) as any), ...(patch as any) });
  };

  const setWeapon = (patch: Partial<NonNullable<ItemData['weapon']>>) => {
    const weapon = value.weapon ?? { type: 'melee', damage: '' };
    set({ weapon: { ...weapon, ...patch } as any });
  };

  const setArmor = (patch: Partial<NonNullable<ItemData['armor']>>) => {
    const armor = value.armor ?? { rating: 0, vs: ['all'] };
    set({ armor: { ...armor, ...patch } as any });
  };

  const tagsCsv = (value.tags ?? []).join(', ');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-sm text-gray-300">Теги (через запятую)</div>
          <Input
            value={tagsCsv}
            onChange={(e) =>
              set({
                tags: e.target.value
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </div>

      {/* Weapon toggle */}
      <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-3">
        <label className="flex items-center gap-2 text-sm text-gray-200">
          <input
            type="checkbox"
            checked={!!value.weapon}
            onChange={(e) => set({ weapon: e.target.checked ? { type: 'melee', damage: ''} : null })}
          />
          Это оружие
        </label>

        {value.weapon ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <div className="text-sm text-gray-300">Тип</div>
              <select
                className="w-full rounded-md border border-gray-700 bg-black/20 px-3 py-2 text-gray-100"
                value={value.weapon.type}
                onChange={(e) => setWeapon({ type: e.target.value as any })}
              >
                <option value="melee">Ближний бой</option>
                <option value="ranged">Дальний бой</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-300">Урон (строка)</div>
              <Input
                value={value.weapon.damage ?? ''}
                onChange={(e) => setWeapon({ damage: e.target.value })}
                className={err('weapon.damage') ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
              />
              {err('weapon.damage') ? <div className="text-xs text-red-400">{err('weapon.damage')}</div> : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Armor toggle */}
      <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-3">
        <label className="flex items-center gap-2 text-sm text-gray-200">
          <input
            type="checkbox"
            checked={!!value.armor}
            onChange={(e) => set({ armor: e.target.checked ? { rating: 0, vs: ['all']} : null })}
          />
          Это броня
        </label>

        {value.armor ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <div className="text-sm text-gray-300">Рейтинг</div>
              <Input
                type="number"
                min={0}
                value={value.armor.rating ?? 0}
                onChange={(e) => setArmor({ rating: Math.max(0, asNumber(e.target.value, 0)) as any })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="text-sm text-gray-300">Против (vs)</div>
              <select
                multiple
                className="w-full min-h-[88px] rounded-md border border-gray-700 bg-black/20 px-3 py-2 text-gray-100"
                value={value.armor.vs ?? ['all']}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setArmor({ vs: (opts.length ? opts : ['all']) as any });
                }}
              >
                <option value="all">Любые</option>
                <option value="melee">Ближний бой</option>
                <option value="ranged">Дальний бой</option>
              </select>
              {err('armor.vs') ? <div className="text-xs text-red-400">{err('armor.vs')}</div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
