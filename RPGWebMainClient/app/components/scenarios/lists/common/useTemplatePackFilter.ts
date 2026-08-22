'use client';

import { useMemo, useState } from 'react';
import type { ScenarioTemplateListItem } from '@/app/services/types2/template_entity';
import type { TemplatePackOption } from './TemplatePackFilter';

export function useTemplatePackFilter<T extends ScenarioTemplateListItem>(items: T[]) {
  const [packFilterId, setPackFilterId] = useState('');

  const packOptions = useMemo<TemplatePackOption[]>(() => {
    const map = new Map<string, TemplatePackOption>();
    for (const item of items) {
      const id = item.template_pack_id ? String(item.template_pack_id) : '';
      if (!id) continue;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: item.template_pack_name || id.slice(0, 8),
          isPrimary: Boolean(item.is_primary_pack),
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!packFilterId) return items;
    return items.filter((item) => String(item.template_pack_id ?? '') === packFilterId);
  }, [items, packFilterId]);

  return {
    packFilterId,
    setPackFilterId,
    packOptions,
    filteredItems,
  };
}
