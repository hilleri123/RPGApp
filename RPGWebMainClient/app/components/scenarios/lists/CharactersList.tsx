'use client';

import { useState } from 'react';
import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { ScenarioCharacterCard } from '../cards/CharacterCard';
import { CharacterEditDialog } from '../dialogs/CharacterEditDialog';
import { useScenario } from '../ScenarioContext';
import { useCharactersList } from '@/app/services/hooks/scenario/lists/useCharactersList';
import { useTabCountEffect } from './common/useTabCountEffect';
import { isLineageProtectedEntity } from '@/app/lib/launchedLineage';

export default function ScenarioCharactersList(props: {templatesToggle?: { checked: boolean; onCheckedChange: (v: boolean) => void };}) {
  const { scenarioId, setTabCount, canEditEntities, scenario } = useScenario();
  const { loading, error, items, refetch, removeById } = useCharactersList(scenarioId);

  useTabCountEffect('characters', items.length, setTabCount);

  return (
    <ScenarioEntityListShell
      title="Персонажи"
      loading={loading}
      error={error ? String(error) : null}
      items={items}
      refetch={refetch}
      readOnly={!canEditEntities}
      onDelete={(x: any) => removeById(String(x.id))}
      canDelete={(x) => !isLineageProtectedEntity(scenario, x)}
      renderCard={({ item, onOpen, onDelete, readOnly }) => (
        <ScenarioCharacterCard
          key={String(item.id)}
          character={item}
          readOnly={readOnly}
          onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
          onDelete={onDelete}
        />
      )}
      renderDialog={({ open, editingId, readOnly, onClose, onSaved }) => (
        <CharacterEditDialog
          open={open}
          onClose={onClose}
          editingId={editingId}
          onSave={onSaved}
          readOnly={readOnly}
        />
      )}
      getDeleteTitle={(x: any) => x.name ?? String(x.id)}
      templatesToggle={props.templatesToggle}
    />
  );
}
