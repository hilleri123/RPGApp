'use client';

import { useMemo, useState } from 'react';
import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { useScenario } from '../ScenarioContext';
import { useLocationsList } from '@/app/services/hooks/scenario/lists/useLocationsList';
import { LocationLibraryDialog } from '../dialogs/LocationLibraryDialog';
import { ScenarioLocationCard } from '../cards/LocationCard';
import { LocationEditDialog } from '../dialogs/LocationEditDialog';
import { useTabCountEffect } from './common/useTabCountEffect';
import { isLineageProtectedEntity } from '@/app/lib/launchedLineage';
import { LOCATION_KINDS, isKindTag, kindOfTags } from '@/app/lib/locationKinds';
import { EntityComboBox } from '../dialogs/common/EntityComboBox';
import type { LocationList } from '@/app/services/types2';

/** Локация и все потомки по parent_location_id. Цикл в данных не зацикливает обход. */
function subtreeIds(roots: string[], items: LocationList[]): Set<string> {
  const children = new Map<string, string[]>();
  for (const loc of items) {
    const pid = loc.parent_location_id ? String(loc.parent_location_id) : '';
    if (!pid) continue;
    const list = children.get(pid) ?? [];
    list.push(String(loc.id));
    children.set(pid, list);
  }
  const out = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const child of children.get(id) ?? []) stack.push(child);
  }
  return out;
}

/** Подпись фильтра: `region:Malta`. Без вида — просто имя. */
function placeLabel(loc: LocationList): string {
  const kind = kindOfTags(loc.tags);
  const name = (loc.name || 'без имени').trim();
  return kind ? `${kind.id}:${name}` : name;
}

export default function ScenarioLocationsList() {
  const { scenarioId, setTabCount, canEditEntities, scenario } = useScenario();
  const { loading, error, items, refetch, removeById } = useLocationsList(scenarioId);

  const [parentFilter, setParentFilter] = useState<string>(''); // '' = все, '__none__' = без родителя
  const [kindFilter, setKindFilter] = useState<string[]>([]); // пусто = все виды; несколько = «или»
  const [placeFilter, setPlaceFilter] = useState<string[]>([]); // id локаций; несколько = «или», каждая со всеми потомками
  const [libraryOpen, setLibraryOpen] = useState(false);

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

  const placeOptions = useMemo(() => {
    return items
      .map((loc) => {
        const kind = kindOfTags(loc.tags);
        return {
          id: String(loc.id),
          name: placeLabel(loc),
          // теги локации, чтобы в выпадающем списке оставался фильтр по ним
          tags: loc.tags ?? [],
          level: kind?.level ?? 99,
        };
      })
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'ru'));
  }, [items]);

  // Виды выбранных мест — только подсветка, сам фильтр «Вид» не включается.
  const highlightedKinds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of placeFilter) {
      const kindId = kindOfTags(locationById.get(id)?.tags)?.id;
      if (kindId) ids.add(kindId);
    }
    return ids;
  }, [placeFilter, locationById]);

  const filteredByParent = useMemo(() => {
    let list = items;
    if (kindFilter.length > 0) {
      const wanted = new Set(kindFilter);
      list = list.filter((loc) => wanted.has(kindOfTags(loc.tags)?.id ?? ''));
    }
    if (placeFilter.length > 0) {
      const inside = subtreeIds(placeFilter, items);
      list = list.filter((loc) => inside.has(String(loc.id)));
    }
    if (!parentFilter) return list;
    if (parentFilter === '__none__') {
      return list.filter((loc) => !loc.parent_location_id);
    }
    return list.filter((loc) => String(loc.parent_location_id ?? '') === parentFilter);
  }, [items, parentFilter, kindFilter, placeFilter]);

  // Только реально используемые виды, в порядке «от крупного к мелкому», с количеством локаций.
  const usedKinds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of items) {
      const id = kindOfTags(l.tags)?.id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return LOCATION_KINDS.filter((k) => counts.has(k.id)).map((k) => ({ ...k, count: counts.get(k.id) ?? 0 }));
  }, [items]);

  const toggleKind = (id: string) =>
    setKindFilter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addPlace = (id: string | null) => {
    if (!id || placeFilter.includes(id)) return;
    setPlaceFilter((prev) => [...prev, id]);
  };

  const customFilters = (
    <>
      {usedKinds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 w-full">
          <span className="text-xs text-gray-400 mr-1">Вид:</span>
          {usedKinds.map((k) => {
            const active = kindFilter.includes(k.id);
            const hinted = highlightedKinds.has(k.id);
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => toggleKind(k.id)}
                title={
                  hinted && !active
                    ? 'Тип выбранной локации. Нажмите, чтобы оставить только этот вид'
                    : 'Можно выбрать несколько видов сразу'
                }
                className={[
                  'rounded-full border px-2 py-0.5 text-xs transition-colors',
                  active
                    ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                    : hinted
                      ? 'border-amber-300/80 bg-amber-400/20 text-amber-50 shadow-[0_0_0_1px_rgba(252,211,77,0.35)]'
                      : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80',
                ].join(' ')}
              >
                {k.emoji} {k.label} <span className="opacity-60">{k.count}</span>
              </button>
            );
          })}
          {kindFilter.length > 0 && (
            <button
              type="button"
              onClick={() => setKindFilter([])}
              className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/40 hover:text-white/70"
            >
              Сброс
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 w-full">
        <span className="text-xs text-gray-400 mr-1">Внутри:</span>
        {placeFilter.map((id) => {
          const loc = locationById.get(id);
          const kind = loc ? kindOfTags(loc.tags) : null;
          const name = (loc?.name || id).trim();
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPlaceFilter((prev) => prev.filter((x) => x !== id))}
              title="Локация и все вложенные. Нажмите, чтобы убрать"
              className="inline-flex items-center gap-1 rounded-full border border-indigo-400/60 bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-100"
            >
              {kind ? (
                <span className="rounded-full bg-amber-400/25 px-1.5 text-amber-50">
                  {kind.emoji} {kind.label}
                </span>
              ) : null}
              <span>{name}</span>
              <span className="text-indigo-200/70">×</span>
            </button>
          );
        })}
        <div className="w-56">
          <EntityComboBox
            value={null}
            items={placeOptions.filter((o) => !placeFilter.includes(o.id))}
            placeholder="region:Malta…"
            onChange={addPlace}
          />
        </div>
        {placeFilter.length > 0 && (
          <button
            type="button"
            onClick={() => setPlaceFilter([])}
            className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/40 hover:text-white/70"
          >
            Сброс
          </button>
        )}
      </div>
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
      // виды местности фильтруются отдельным рядом (с выбором нескольких); в обычных тегах их не дублируем
      getItemTags={(x: any) => (x.tags ?? []).filter((t: string) => !isKindTag(t))}
      onImportExisting={() => setLibraryOpen(true)}
      importExistingLabel="Из библиотеки"
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
      extraDialogs={
        <LocationLibraryDialog
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          targetScenarioId={scenarioId}
          ruleIdStr={(scenario as any)?.rule_id_str ?? null}
          onImported={() => void refetch()}
        />
      }
    />
  );
}
