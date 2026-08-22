'use client';

import type { ItemData } from '../types';

type Props = {
  data: Record<string, any>;
  config?: any;
};

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function asStrList(x: any): string[] {
  return (Array.isArray(x) ? x : []).map((v) => String(v ?? '').trim()).filter(Boolean);
}

export default function ItemDataView({ data }: Props) {
  const item = ((isPlainObject(data) ? data : {}) as any) as ItemData;

  const type = (item as any).type ?? '—';

  const req = asStrList((item as any).requiredTags);
  const key = asStrList((item as any).keyTags);
  const labels = asStrList((item as any).tags);

  const hasDamage = isPlainObject(item) && 'damage' in (item as any);
  const damage = hasDamage ? ((Array.isArray((item as any).damage) ? (item as any).damage : []) as any[]) : [];

  const hasMagic = isPlainObject(item) && 'magic' in (item as any);
  const magic = hasMagic ? String((item as any).magic ?? 'none') : null;

  // name/description могут быть “лишними” для строгого бэка (extra='forbid'), но для view можно показывать если есть
  const name = isPlainObject(item) && 'name' in (item as any) ? String((item as any).name ?? '') : '';
  const description = isPlainObject(item) && 'description' in (item as any) ? String((item as any).description ?? '') : '';

  return (
    <div className="space-y-2">
      {name ? <div className="text-sm text-white/90">{name}</div> : null}

      <div className="text-white/90">
        <div className="text-sm">
          Тип: <span className="text-white/70">{type}</span>
        </div>

        {hasMagic ? (
          <div className="text-sm">
            Магия: <span className="text-white/70">{magic}</span>
          </div>
        ) : null}
      </div>

      {hasDamage && damage.length ? (
        <div className="text-sm text-white/80">
          Урон:
          <ul className="list-disc pl-5">
            {damage.map((d, i) => (
              <li key={i}>
                {String(d?.dtype ?? '—')}: {Number(d?.base ?? 0) || 0}
                {d?.notes ? ` (${String(d.notes)})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {req.length ? <div className="text-sm text-white/80">Required: {req.join(', ')}</div> : null}
      {key.length ? <div className="text-sm text-white/80">Key: {key.join(', ')}</div> : null}
      {labels.length ? <div className="text-sm text-white/70">Tags: {labels.join(', ')}</div> : null}

      {description ? <div className="text-sm text-white/70">{description}</div> : null}
    </div>
  );
}
