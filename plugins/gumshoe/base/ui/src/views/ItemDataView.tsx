'use client';

import { ItemData } from '../types';

type Props = {
  data: Record<string, any>;
  config?: any;
};

export default function ItemDataView({ data }: Props) {
  const item = (data ?? {}) as ItemData;

  const tags = (item.tags ?? []).filter(Boolean);

  return (
    <div className="space-y-3">
      {tags.length ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded border border-gray-700 bg-black/20 text-gray-200">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {item.weapon ? (
        <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-1">
          <div className="text-sm text-white">Оружие</div>
          <div className="text-sm text-gray-300">
            Тип: <span className="text-gray-100">{item.weapon.type === 'melee' ? 'ближний' : 'дальний'}</span>
          </div>
          <div className="text-sm text-gray-300">
            Урон: <span className="text-gray-100">{item.weapon.damage || '—'}</span>
          </div>
        </div>
      ) : null}

      {item.armor ? (
        <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-1">
          <div className="text-sm text-white">Броня</div>
          <div className="text-sm text-gray-300">
            Рейтинг: <span className="text-gray-100">{item.armor.rating ?? 0}</span>
          </div>
          {item.armor.vs?.length ? (
            <div className="text-sm text-gray-300">
              Против: <span className="text-gray-100">{item.armor.vs.join(', ')}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {!item.weapon && !item.armor ? (
        <div className="text-xs text-gray-500">Нет боевых параметров (обычный предмет).</div>
      ) : null}
    </div>
  );
}
