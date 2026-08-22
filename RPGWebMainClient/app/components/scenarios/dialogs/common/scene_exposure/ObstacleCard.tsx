'use client';

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { ScenarioEntityCardShell } from '@/app/components/scenarios/cards/common/ScenarioEntityCardShell';

export function ObstacleCard(props: {
  id: string;
  name: string;
  readOnly: boolean;
  onRemove?: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  const canEdit = !!props.onEdit && !props.readOnly;
  const canDelete = !!props.onRemove && !props.readOnly;

  return (
    <ScenarioEntityCardShell
      accentColor="#f59e0b" // amber-500
      typeLabel="Препятствие"
      title={props.name || 'Без названия'}
      subtitle={props.id}
      iconNode={
        <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <TriangleAlert className="w-5 h-5 text-amber-300" />
        </div>
      }
      // если потом захочешь: badges={<.../>}
      onEdit={
        props.onEdit
          ? () => {
              if (!canEdit) return;
              props.onEdit?.(props.id);
            }
          : undefined
      }
      onDelete={
        props.onRemove
          ? async () => {
              if (!canDelete) return;
              props.onRemove?.(props.id);
            }
          : undefined
      }
      // можно добавить кастомный текст подтверждения, если подключишь ConfirmAlertDialog в Shell
      // deleteConfirmText={...}
    />
  );
}
