'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import { EntityComboBox, IdName } from './EntityComboBox';

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

export default function RelationsTab({
  title,
  items,
  selectedIds,
  onChange,
  placeholder,
  readOnly = false,
}: {
  title: string;
  items: IdName[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const [toAdd, setToAdd] = useState<string | null>(null);

  const selected = useMemo(() => {
    const map = new Map(items.map(i => [i.id, i.name]));
    return selectedIds.map(id => ({ id, name: map.get(id) ?? id }));
  }, [items, selectedIds]);

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-white">{title}</div>

      <div className="space-y-2">
        {selected.length === 0 ? (
          <div className="text-sm text-gray-400">Пусто</div>
        ) : selected.map(x => (
          <div key={x.id} className="flex items-center justify-between bg-gray-800 rounded p-2">
            <span className="truncate">{x.name}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange(selectedIds.filter(id => id !== x.id))}
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <EntityComboBox
            value={toAdd}
            items={items.filter(i => !selectedIds.includes(i.id))}
            placeholder={placeholder ?? 'Выбрать...'}
            onChange={setToAdd}
          />
        </div>
        <Button
          variant="outline"
          disabled={!toAdd}
          onClick={() => {
            if (!toAdd) return;
            onChange(uniq([...selectedIds, toAdd]));
            setToAdd(null);
          }}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
