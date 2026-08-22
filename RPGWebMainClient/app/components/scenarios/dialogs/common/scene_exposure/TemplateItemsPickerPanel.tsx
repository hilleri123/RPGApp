'use client';

import React, { useMemo } from 'react';
import type { IdName } from './SceneExposuresContext';
import { useSceneExposures } from './SceneExposuresContext';
import { EntityPickerList } from './EntityPickerList';
import { ScenarioItemCard } from '../../../cards/ItemCard';
import type { GameItemWithOwnerShort, TemplateItemLink } from '@/app/services/types2';

function makeMap(xs: IdName[]) {
  const m: Record<string, IdName> = {};
  for (const x of xs) m[String(x.id)] = x;
  return m;
}

export function TemplateItemsPickerPanel(props: { itemOptions?: GameItemWithOwnerShort[] | null }) {
  const {
    readOnly,
    selected,
    addTemplateItem,
    removeTemplateItem,
    setTemplateItemQty,
  } = useSceneExposures();

  const itemById = useMemo(() => makeMap(props.itemOptions ?? []), [props.itemOptions]);

  if (!selected) return null;

  return (
    <EntityPickerList<TemplateItemLink>
      title="Шаблонные предметы"
      readOnly={readOnly}
      searchOptions={props.itemOptions}
      addPlaceholder="Добавить шаблонный предмет..."
      selected={selected.template_item_links ?? []}
      onPick={
        props.itemOptions
          ? (id) =>
              addTemplateItem(
                id ? ((itemById[String(id)] as GameItemWithOwnerShort) ?? null) : null,
                1,
              )
          : undefined
      }
      onRemove={removeTemplateItem}
      renderCard={({ item, onRemove }) => (
        <div className="space-y-1">
          <ScenarioItemCard
            item={item.template_item}
            onDelete={() => onRemove?.(item.template_item.id)}
          />
          <div className="flex items-center gap-2 px-2 pb-1">
            <span className="text-xs text-gray-400">Кол-во:</span>
            {readOnly ? (
              <span className="text-xs font-semibold text-gray-200">{item.qty}</span>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTemplateItemQty(item.template_item.id, item.qty - 1)}
                  disabled={item.qty <= 1}
                  className="w-5 h-5 flex items-center justify-center rounded border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-30 text-xs"
                >
                  −
                </button>
                <span className="text-xs font-semibold text-gray-100 w-6 text-center tabular-nums">
                  {item.qty}
                </span>
                <button
                  type="button"
                  onClick={() => setTemplateItemQty(item.template_item.id, item.qty + 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-gray-600 text-gray-300 hover:bg-gray-700 text-xs"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      getKey={(x) => x.template_item.id}
    />
  );
}