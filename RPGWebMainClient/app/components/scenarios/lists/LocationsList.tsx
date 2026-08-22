'use client';

import { useMemo, useState } from 'react';
import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { useScenario } from '../ScenarioContext';
import { useLocationsList } from '@/app/services/hooks/scenario/lists/useLocationsList';
import { ScenarioLocationCard } from '../cards/LocationCard';
import { LocationEditDialog } from '../dialogs/LocationEditDialog';
import { useTabCountEffect } from './common/useTabCountEffect';
import { isLineageProtectedEntity } from '@/app/lib/launchedLineage';
import type { LocationList } from '@/app/services/types2';

export default function ScenarioLocationsList() {
  const { scenarioId, setTabCount, canEditEntities, scenario } = useScenario();
  const { loading, error, items, refetch, removeById } = useLocationsList(scenarioId);

  const [parentFilter, setParentFilter] = useState<string>(''); // '' = все, '__none__' = без родителя

  useTabCountEffect('locations', items.length, setTabCount);

  const locationById = useMemo(() => {
    const m = new Map<string, LocationList>();
    for (const loc of items) m.set(String(loc.id), loc);
    return m;
  }, [items]);

  const parentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const loc of items) {
      if (loc.parent_location_id) {
        const pid = String(loc.parent_location_id);
        const parent = locationById.get(pid);
        seen.set(pid, parent?.name ?? pid);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items, locationById]);

  const filteredByParent = useMemo(() => {
    if (!parentFilter) return items;
    if (parentFilter === '__none__') {
      return items.filter((loc) => !loc.parent_location_id);
    }
    return items.filter((loc) => String(loc.parent_location_id ?? '') === parentFilter);
  }, [items, parentFilter]);

  const customFilters = (
    <>
      <select
        value={parentFilter}
        onChange={(e) => setParentFilter(e.target.value)}
        className="rounded-md border border-gray-700 bg-black/40 text-gray-100 text-sm px-2 py-1.5"
      >
        <option value="">Все локации</option>
        <option value="__none__">Без родителя</option>
        {parentOptions.map(([id, name]) => (
          <option key={id} value={id}>
            Родитель: {name}
          </option>
        ))}
      </select>
      {(parentFilter) && (
        <button
          type="button"
          onClick={() => setParentFilter('')}
          className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded border border-gray-700"
        >
          сбросить родителя
        </button>
      )}
    </>
  );

  return (
    <ScenarioEntityListShell
      title="Локации"
      loading={loading}
      error={error ? String(error) : null}
      items={filteredByParent}
      refetch={refetch}
      readOnly={!canEditEntities}
      onDelete={(x: any) => removeById(String(x.id))}
      canDelete={(x) => !isLineageProtectedEntity(scenario, x)}
      customFilters={customFilters}
      renderCard={({ item, onOpen, onDelete, readOnly }) => (
        <ScenarioLocationCard
          key={String(item.id)}
          location={item}
          readOnly={readOnly}
          onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
          onDelete={onDelete}
        />
      )}
      renderDialog={({ open, editingId, readOnly, onClose, onSaved }) => (
        <LocationEditDialog
          open={open}
          onClose={onClose}
          editingId={editingId}
          onSave={onSaved}
          readOnly={readOnly}
        />
      )}
      getDeleteTitle={(x: any) => x.name ?? String(x.id)}
    />
  );
}
