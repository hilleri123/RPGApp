'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AudioTagFilter } from './AudioTagFilter';

export function AudioSearchFilters({
  query,
  onQueryChange,
  activeTags,
  onActiveTagsChange,
  placeholder = 'Поиск по названию, описанию и тегам...',
}: {
  query: string;
  onQueryChange: (v: string) => void;
  activeTags: string[];
  onActiveTagsChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="pl-8 h-8 text-xs"
        />
      </div>
      <AudioTagFilter value={activeTags} onChange={onActiveTagsChange} size="xs" />
    </div>
  );
}
