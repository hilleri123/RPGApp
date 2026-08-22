'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';

// ── типы (приходят с бэка через config.tags) ─────────────────────────────────

type TagMeta = { id: string; label: string; hint?: string; effect?: string };

type ItemConfig = {
  initialData: Record<string, any>;
  tags: {
    range:           TagMeta[];
    weapon_mechanic: TagMeta[];
    armor_mechanic:  TagMeta[];
    general:         TagMeta[];
  };
};

type Props = {
  data: Record<string, any>;
  config?: ItemConfig;
  issues?: Array<{ path: string; message: string; icon?: string }>;
  onChange: (next: Record<string, any>) => void;
};

// ── хелперы ───────────────────────────────────────────────────────────────────

function toggleArr(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

function asInt(x: any, fb = 0): number {
  const n = parseInt(x, 10);
  return Number.isFinite(n) ? n : fb;
}

function isEmptyData(x: any): boolean {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return true;
  return !('weapon' in x) && !('armor' in x) && Object.keys(x).length === 0;
}

// ── TagButton ─────────────────────────────────────────────────────────────────

function TagButton({
  tag, active, onClick,
}: {
  tag: TagMeta; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={tag.effect ?? tag.hint}
      onClick={onClick}
      className={`
        rounded border px-2 py-0.5 text-xs font-medium transition-colors
        ${active
          ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-200'
          : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
        }
      `}
    >
      {tag.label}
    </button>
  );
}

// ── Редактор ──────────────────────────────────────────────────────────────────

export default function ItemDataEditor({ data, config, issues, onChange }: Props) {
  const initKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const init = config?.initialData;
    if (!init) return;
    const key = 'item';
    if (initKeyRef.current === key) return;
    if (!isEmptyData(data)) { initKeyRef.current = key; return; }
    initKeyRef.current = key;
    onChange(structuredClone(init));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // ── значения ──────────────────────────────────────────────────────────────
  const v = (data && typeof data === 'object' ? data : {}) as any;

  const generalTags: string[] = v.general_tags ?? [];
  const weight: number        = v.weight ?? 1;
  const cost: number | null   = v.cost   ?? null;
  const weapon                = v.weapon ?? null;
  const armor                 = v.armor  ?? null;

  // weapon
  const wRangeTags:  string[] = weapon?.range_tags    ?? [];
  const wMechTags:   string[] = weapon?.mechanic_tags ?? [];
  const wDmgBonus:   number   = weapon?.damage_bonus?.bonus ?? 0;
  const wPiercing:   number   = weapon?.piercing?.value     ?? 0;
  const wAmmo:       number   = weapon?.ammo?.value         ?? 0;

  // armor
  const aValue:    number   = armor?.armor?.value   ?? 1;
  const aStacks:   boolean  = armor?.armor?.stacks  ?? false;
  const aMechTags: string[] = armor?.mechanic_tags  ?? [];

  // ── ошибки ────────────────────────────────────────────────────────────────
  const errMap = useMemo(() => {
    const m = new Map<string, { message: string; icon?: string }>();
    for (const i of issues ?? []) {
      const p = i.path.startsWith('data.') ? i.path.slice(5) : i.path;
      m.set(p, i);
    }
    return m;
  }, [issues]);

  const err  = (p: string) => errMap.get(p)?.message;
  const warn = (p: string) => errMap.get(p)?.icon === 'warning'
    ? errMap.get(p)?.message : undefined;

  // ── патч-хелперы ──────────────────────────────────────────────────────────
  const set = (patch: any) => onChange({ ...structuredClone(v), ...patch });

  const setWeapon = (patch: any) =>
    set({ weapon: { ...(structuredClone(weapon) ?? {}), ...patch } });

  const setArmor = (patch: any) =>
    set({ armor: { ...(structuredClone(armor) ?? {}), ...patch } });

  // теги из конфига (с фолбэком если конфиг ещё не загружен)
  const tagsCfg = config?.tags ?? { range: [], weapon_mechanic: [], armor_mechanic: [], general: [] };

  // ── превью строки тегов ───────────────────────────────────────────────────
  const weaponPreview = weapon ? [
    weapon.damage_dice ?? 'куб класса',   // ← добавили
    ...wRangeTags,
    wDmgBonus > 0 ? `+${wDmgBonus} damage` : null,
    wPiercing > 0 ? `${wPiercing} piercing` : null,
    wAmmo > 0     ? `${wAmmo} ammo`         : null,
    ...wMechTags,
  ].filter(Boolean).join(', ') : null;

  const armorPreview = armor ? [
    aStacks ? `+${aValue} armor` : `${aValue} armor`,
    ...aMechTags,
  ].join(', ') : null;

  return (
    <div className="space-y-4 text-sm">

      {/* ── Вес / Стоимость ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="text-white/60">Вес (weight)</div>
          <Input
            type="number" min={0}
            value={weight}
            onChange={(e) => set({ weight: Math.max(0, asInt(e.target.value)) })}
          />
        </div>
        <div className="space-y-1">
          <div className="text-white/60">Цена (монет)</div>
          <Input
            type="number" min={0}
            value={cost ?? ''}
            placeholder="—"
            onChange={(e) => set({ cost: e.target.value ? asInt(e.target.value) : null })}
          />
        </div>
      </div>

      {/* ── Общие теги ── */}
      {tagsCfg.general.length > 0 && (
        <div className="space-y-1">
          <div className="text-white/60">Общие теги</div>
          <div className="flex flex-wrap gap-1.5">
            {tagsCfg.general.map((t) => (
              <TagButton
                key={t.id} tag={t}
                active={generalTags.includes(t.id)}
                onClick={() => set({ general_tags: toggleArr(generalTags, t.id) })}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Оружие ── */}
      <div className="rounded border border-white/10 bg-black/20 p-3 space-y-3">
        <label className="flex items-center gap-2 text-white/80 cursor-pointer select-none">
          <input
            type="checkbox" checked={!!weapon}
            onChange={(e) => set({
              weapon: e.target.checked
                ? { range_tags: [], mechanic_tags: [], damage_bonus: null, piercing: null, ammo: null }
                : null,
            })}
          />
          ⚔️ Это оружие
        </label>

        {weapon && (
          <div className="space-y-3 pl-1">

            {/* Дальность */}
            <div className="space-y-1">
              <div className="text-white/50 text-xs">Дальность *</div>
              <div className="flex flex-wrap gap-1.5">
                {tagsCfg.range.map((t) => (
                  <TagButton
                    key={t.id} tag={t}
                    active={wRangeTags.includes(t.id)}
                    onClick={() => setWeapon({ range_tags: toggleArr(wRangeTags, t.id) })}
                  />
                ))}
              </div>
              {err('weapon.range_tags') && (
                <div className="text-xs text-red-400">{err('weapon.range_tags')}</div>
              )}
            </div>

            {/* Механические теги */}
            <div className="space-y-1">
              <div className="text-white/50 text-xs">Теги оружия</div>
              <div className="flex flex-wrap gap-1.5">
                {tagsCfg.weapon_mechanic.map((t) => (
                  <TagButton
                    key={t.id} tag={t}
                    active={wMechTags.includes(t.id)}
                    onClick={() => setWeapon({ mechanic_tags: toggleArr(wMechTags, t.id) })}
                  />
                ))}
              </div>
            </div>

            {/* Куб урона */}
            <div className="space-y-1">
              <div className="text-white/50 text-xs">
                Куб урона
                <span className="text-white/25 ml-1">(пусто = куб класса)</span>
              </div>
              <select
                className="w-full rounded border bg-zinc-950/30 px-2 py-1.5 text-xs text-gray-100"
                value={weapon?.damage_dice ?? ''}
                onChange={(e) => setWeapon({ damage_dice: e.target.value || null })}
              >
                <option value="">— куб класса —</option>
                {['d4', 'd6', 'd8', 'd10', 'd12', '2d6'].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Числа */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '+damage', val: wDmgBonus, key: 'damage_bonus',
                  toField: (n: number) => n > 0 ? { bonus: n } : null },
                { label: 'Piercing', val: wPiercing, key: 'piercing',
                  toField: (n: number) => n > 0 ? { value: n } : null },
                { label: 'Ammo',    val: wAmmo,    key: 'ammo',
                  toField: (n: number) => n > 0 ? { value: n } : null },
              ].map(({ label, val, key, toField }) => (
                <div key={key} className="space-y-1">
                  <div className="text-white/50 text-xs">{label}</div>
                  <Input
                    type="number" min={0} max={9}
                    value={val || ''}
                    placeholder="0"
                    onChange={(e) => setWeapon({ [key]: toField(asInt(e.target.value)) })}
                  />
                </div>
              ))}
            </div>

            {/* Превью */}
            <div className="text-xs text-white/30 font-mono">
              {weaponPreview || '—'}
            </div>
          </div>
        )}
      </div>

      {/* ── Броня / Щит ── */}
      <div className="rounded border border-white/10 bg-black/20 p-3 space-y-3">
        <label className="flex items-center gap-2 text-white/80 cursor-pointer select-none">
          <input
            type="checkbox" checked={!!armor}
            onChange={(e) => set({
              armor: e.target.checked
                ? { armor: { value: 1, stacks: false }, mechanic_tags: ['worn'] }
                : null,
            })}
          />
          🛡️ Это броня / щит
        </label>

        {armor && (
          <div className="space-y-3 pl-1">

            <div className="grid grid-cols-2 gap-3">
              {/* Значение */}
              <div className="space-y-1">
                <div className="text-white/50 text-xs">Значение брони *</div>
                <Input
                  type="number" min={0} max={5}
                  value={aValue}
                  onChange={(e) =>
                    setArmor({ armor: { value: Math.max(0, asInt(e.target.value)), stacks: aStacks } })
                  }
                />
                {err('armor.armor') && (
                  <div className="text-xs text-red-400">{err('armor.armor')}</div>
                )}
              </div>

              {/* Тип: n armor vs +n armor */}
              <div className="space-y-1">
                <div className="text-white/50 text-xs">Тип значения</div>
                <div className="flex flex-col gap-1 pt-1">
                  {[
                    { stacks: false, label: `${aValue} armor` },
                    { stacks: true,  label: `+${aValue} armor (щит)` },
                  ].map((opt) => (
                    <label key={String(opt.stacks)}
                      className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                      <input
                        type="radio"
                        checked={aStacks === opt.stacks}
                        onChange={() => setArmor({ armor: { value: aValue, stacks: opt.stacks } })}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Теги брони */}
            <div className="space-y-1">
              <div className="text-white/50 text-xs">Теги брони</div>
              <div className="flex flex-wrap gap-1.5">
                {tagsCfg.armor_mechanic.map((t) => (
                  <TagButton
                    key={t.id} tag={t}
                    active={aMechTags.includes(t.id)}
                    onClick={() => setArmor({ mechanic_tags: toggleArr(aMechTags, t.id) })}
                  />
                ))}
              </div>
              {warn('armor.mechanic_tags') && (
                <div className="text-xs text-yellow-400/70">⚠ {warn('armor.mechanic_tags')}</div>
              )}
            </div>

            {/* Превью */}
            <div className="text-xs text-white/30 font-mono">
              {armorPreview}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
