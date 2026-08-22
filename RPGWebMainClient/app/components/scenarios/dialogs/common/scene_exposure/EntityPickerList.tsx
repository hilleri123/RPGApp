'use client';

import React from 'react';
import { EntityComboBox } from '../EntityComboBox';
import type { IdName } from './SceneExposuresContext';

export type EntityCardRenderProps<T = IdName> = {
  item: T;
  readOnly: boolean;
  onRemove?: (id: string) => void;
  onEdit?: (id: string) => void;
};

export function EntityPickerList<T = IdName>(props: {
  title: string;
  readOnly?: boolean;

  searchOptions?: IdName[] | null;
  addPlaceholder?: string;

  selected: T[];

  onPick?: (id: string | null) => void;
  onRemove?: (id: string) => void;
  onEdit?: (id: string) => void;

  renderCard: (p: EntityCardRenderProps<T>) => React.ReactNode;

  emptyText?: string;

  getKey?: (item: T, idx: number) => React.Key;
  comboFilterItem?: (item: IdName, query: string) => boolean;
  comboHeader?: React.ReactNode;
}) {
  const {
    title,
    readOnly,
    searchOptions,
    addPlaceholder,
    selected,
    onPick,
    onRemove,
    onEdit,
    renderCard,
    emptyText,
    getKey,
    comboFilterItem,
    comboHeader,
  } = props;

  const ro = !!readOnly;
  const showPicker = !!searchOptions && !!onPick;

  return (
    <div className="space-y-3">
      {showPicker && (
        <div className="space-y-2">
          {comboHeader}
          <EntityComboBox
            value={null}
            items={searchOptions!}
            placeholder={addPlaceholder ?? 'Добавить...'}
            readOnly={ro}
            onChange={onPick}
            filterItem={comboFilterItem}
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs text-gray-400">{title}</div>

        {(selected ?? []).length === 0 ? (
          <div className="text-sm text-gray-400">{emptyText ?? 'Пусто.'}</div>
        ) : (
          <div className="space-y-2">
            {(selected ?? []).map((x, idx) => (
              <React.Fragment key={getKey ? getKey(x, idx) : idx}>
                {renderCard({ item: x, readOnly: ro, onRemove, onEdit })}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}