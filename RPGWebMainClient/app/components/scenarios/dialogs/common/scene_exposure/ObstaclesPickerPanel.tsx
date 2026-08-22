'use client';

import React from 'react';
import { useSceneExposures } from './SceneExposuresContext';
import { EntityPickerList } from './EntityPickerList';
import { ObstacleCard } from './ObstacleCard';

export function ObstaclesPickerPanel() {
  const { readOnly, selected, setRightTab, openObstacleEditor, addNewObstacleInline, removeObstacleAt } =
    useSceneExposures();

  if (!selected) return null;

  const obstacles = selected.obstacles ?? [];

  // делаем IdName[]; id должен быть уникальным => берём idx
  const selectedCards = obstacles.map((o, idx) => ({
    id: String(idx),
    name: (o?.name ?? '').trim() || 'Без названия',
  }));

  return (
    <EntityPickerList
      title="Препятствия"
      readOnly={readOnly}
      searchOptions={null}          // поиска нет
      addPlaceholder="Новое препятствие"
      selected={selectedCards}
      onPick={readOnly ? undefined : () => addNewObstacleInline()}
      onRemove={(id) => removeObstacleAt(Number(id))}
      onEdit={(id) => {
        const idx = Number(id);
        if (!Number.isFinite(idx)) return;
        setRightTab('obstacles');
        openObstacleEditor(idx);
      }}
      renderCard={({ item, readOnly, onRemove, onEdit }) => (
        <ObstacleCard id={item.id} name={item.name} readOnly={readOnly} onRemove={onRemove} onEdit={onEdit} />
      )}
      getKey={(item) => item.id}
    />
  );
}
