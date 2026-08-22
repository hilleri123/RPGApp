'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useSceneExposures } from './SceneExposuresContext';
import { ObstacleEditorPanel } from './ObstacleEditorPanel';
import { ObstaclesPickerPanel } from './ObstaclesPickerPanel';

export function ObstaclesPanel(props: { config?: any }) {
  const { readOnly, selected, editingObstacleIdx, addNewObstacleInline, openObstacleEditor, closeObstacleEditor } =
    useSceneExposures();

  if (!selected) return <div className="text-gray-400 text-sm">Сначала выбери экспозицию слева.</div>;

  if (editingObstacleIdx != null) {
    return <ObstacleEditorPanel config={props.config} onBack={closeObstacleEditor} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant="outline" onClick={addNewObstacleInline} disabled={readOnly}>
          Создать препятствие
        </Button>
      </div>

      <ObstaclesPickerPanel />
    </div>
  );
}
