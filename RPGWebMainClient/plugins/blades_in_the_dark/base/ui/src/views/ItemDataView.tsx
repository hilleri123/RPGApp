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
    <div className="flex flex-col gap-2">
      <div className="text-sm">
        <span className="text-muted-foreground">Quality:</span> {item.quality ?? '—'}
      </div>

      {tags.length ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="text-xs px-2 py-1 rounded bg-muted">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {item.description ? <div className="text-sm text-muted-foreground">{item.description}</div> : null}
    </div>
  );
}
