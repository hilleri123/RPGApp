'use client';

import type { ItemData } from '../types';

type Props = {
  data: Record<string, any>;
};

export default function ItemDataView({ data }: Props) {
  const item = (data ?? {}) as ItemData;

  const generalTags: string[] = item.general_tags ?? [];
  const weapon = item.weapon ?? null;
  const armor  = item.armor  ?? null;

  // строка превью оружия
  const weaponLine = weapon ? [
    weapon.damage_dice ?? 'куб класса',
    ...weapon.range_tags,
    ...(weapon.damage_bonus ? [`+${weapon.damage_bonus.bonus} damage`] : []),
    ...(weapon.piercing     ? [`${weapon.piercing.value} piercing`]    : []),
    ...(weapon.ammo         ? [`${weapon.ammo.value} ammo`]            : []),
    ...weapon.mechanic_tags,
  ].filter(Boolean).join(', ') : null;

  const armorLine = armor ? [
    armor.armor
      ? (armor.armor.stacks ? `+${armor.armor.value} armor` : `${armor.armor.value} armor`)
      : null,
    ...armor.mechanic_tags,
  ].filter(Boolean).join(', ') : null;

  return (
    <div className="space-y-3">

      {/* Общие теги + вес/цена */}
      <div className="flex flex-wrap gap-2 items-center">
        {generalTags.map((t) => (
          <span key={t} className="text-xs px-2 py-0.5 rounded border border-gray-700 bg-black/20 text-gray-200">
            {t}
          </span>
        ))}
        <span className="text-xs text-gray-500">
          Вес: <span className="text-gray-300">{item.weight ?? 1}</span>
        </span>
        {item.cost != null && (
          <span className="text-xs text-gray-500">
            Цена: <span className="text-gray-300">{item.cost}</span>
          </span>
        )}
      </div>

      {/* Оружие */}
      {weapon && (
        <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-1">
          <div className="text-sm text-white">⚔️ Оружие</div>
          <div className="text-xs font-mono text-gray-300">{weaponLine}</div>
        </div>
      )}

      {/* Броня */}
      {armor && (
        <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-1">
          <div className="text-sm text-white">🛡️ Броня / Щит</div>
          <div className="text-xs font-mono text-gray-300">{armorLine}</div>
        </div>
      )}

      {!weapon && !armor && (
        <div className="text-xs text-gray-500">Обычный предмет, нет боевых параметров.</div>
      )}

    </div>
  );
}