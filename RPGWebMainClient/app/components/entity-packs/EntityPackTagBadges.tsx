'use client';

import { cn } from '@/lib/utils';
import { formatPackTagLabel } from './entityPackUtils';

export function EntityPackTagBadges({
  tags,
  className,
}: {
  tags: string[];
  className?: string;
}) {
  if (!tags.length) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            'inline-flex px-2 py-0.5 rounded-md text-[11px] border',
            tag === 'default'
              ? 'bg-gray-500/15 border-gray-500/40 text-gray-300'
              : 'bg-sky-500/10 border-sky-500/40 text-sky-200',
          )}
        >
          {formatPackTagLabel(tag)}
        </span>
      ))}
    </div>
  );
}
