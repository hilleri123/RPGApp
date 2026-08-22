'use client';

import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { useScenario } from '../ScenarioContext';
import { useNotesList } from '@/app/services/hooks/scenario/lists/useNotesList';
import { ScenarioNoteCard } from '../cards/NoteCard';
import { NoteEditDialog } from '../dialogs/NoteEditDialog';
import { useTabCountEffect } from './common/useTabCountEffect';
import { isLineageProtectedEntity } from '@/app/lib/launchedLineage';

export default function ScenarioNotesList() {
  const { scenarioId, setTabCount, canEditEntities, scenario } = useScenario();
  const { loading, error, items, refetch, removeById } = useNotesList(scenarioId);

  useTabCountEffect('notes', items.length, setTabCount);

  return (
    <ScenarioEntityListShell
      title="Заметки"
      loading={loading}
      error={error ? String(error) : null}
      items={items}
      refetch={refetch}
      readOnly={!canEditEntities}
      onDelete={(x: any) => removeById(String(x.id))}
      canDelete={(x) => !isLineageProtectedEntity(scenario, x)}
      renderCard={({ item, onOpen, onDelete, readOnly }) => (
        <ScenarioNoteCard
          key={String(item.id)}
          note={item}
          readOnly={readOnly}
          onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
          onDelete={onDelete}
        />
      )}
      renderDialog={({ open, editingId, readOnly, onClose, onSaved }) => (
        <NoteEditDialog
          open={open}
          onClose={onClose}
          editingId={editingId}
          onSave={onSaved}
          readOnly={readOnly}
        />
      )}
      getDeleteTitle={(x: any) => x.title ?? x.name ?? String(x.id)}
    />
  );
}
