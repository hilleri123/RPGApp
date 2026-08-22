'use client';

import { cn } from '@/lib/utils';

export function TemplatePackChip({
  name,
  isPrimary,
  className,
}: {
  name: string;
  isPrimary?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-[160px] truncate px-2 py-0.5 rounded-md text-[11px] border',
        isPrimary
          ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
          : 'bg-violet-500/10 border-violet-500/40 text-violet-200',
        className,
      )}
      title={name}
    >
      {name}
    </span>
  );
}
