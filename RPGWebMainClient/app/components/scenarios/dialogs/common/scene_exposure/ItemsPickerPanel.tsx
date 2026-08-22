'use client';

import React, { useMemo } from 'react';
import type { IdName } from './SceneExposuresContext';
import { useSceneExposures } from './SceneExposuresContext';
import { EntityPickerList } from './EntityPickerList';
import { ScenarioItemCard } from '../../../cards/ItemCard';
import { GameItemWithOwnerShort } from '@/app/services/types2';

function makeMap(xs: IdName[]) {
  const m: Record<string, IdName> = {};
  for (const x of xs) m[String(x.id)] = x;
  return m;
}

export function ItemsPickerPanel(props: { itemOptions?: GameItemWithOwnerShort[] | null }) {
  const { readOnly, selected, addItem, removeItem } = useSceneExposures();
  const itemById = useMemo(() => makeMap(props.itemOptions ?? []), [props.itemOptions]);

  if (!selected) return null;

  return (
    <EntityPickerList
      title="Предметы"
      readOnly={readOnly}
      searchOptions={props.itemOptions}
      addPlaceholder="Добавить предмет..."
      selected={selected.items}
      onPick={
        props.itemOptions
          ? (id) => addItem(id ? (itemById[String(id)] as GameItemWithOwnerShort) ?? null : null)
          : undefined
      }
      onRemove={removeItem}
      renderCard={({ item, readOnly, onRemove }) => (
        <ScenarioItemCard
          item={item}
          onDelete={() => onRemove?.(item.id)}
        />
      )}
      getKey={(x) => x.id}
    />
  );
}
