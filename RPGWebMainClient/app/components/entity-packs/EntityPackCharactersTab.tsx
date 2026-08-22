'use client';

import { useState } from 'react';
import { useCharacterTemplatesList } from '@/app/services/hooks/templates/lists/useCharacterTemplatesList';
import { ScenarioEntityListShell } from '@/app/components/scenarios/lists/common/ScenarioEntityListShell';
import { ScenarioCharacterCard } from '@/app/components/scenarios/cards/CharacterCard';
import { CharacterTemplateEditDialog } from '@/app/components/scenarios/dialogs/CharacterTemplateEditDialog';
import { ImportExistingTemplateDialog } from '@/app/components/scenarios/dialogs/ImportExistingTemplateDialog';
import type { EntityPack } from '@/app/services/api/entityPacks';

export function EntityPackCharactersTab({ pack }: { pack: EntityPack }) {
  const [importOpen, setImportOpen] = useState(false);
  const { loading, error, items, refetch, removeById } = useCharacterTemplatesList(pack.id);

  return (
    <>
      <ScenarioEntityListShell
        title="Персонажи (шаблоны пака)"
        loading={loading}
        error={error ? String(error) : null}
        items={items}
        refetch={refetch}
        onDelete={(ch) => removeById(String(ch.id))}
        onImportExisting={() => setImportOpen(true)}
        importExistingLabel="Добавить существующий"
        renderCard={({ item, onOpen, onDelete, readOnly }) => (
          <ScenarioCharacterCard
            key={String(item.id)}
            character={item}
            readOnly={readOnly}
            packChip={{ name: pack.name, isPrimary: true }}
            onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
            onDelete={onDelete}
          />
        )}
        renderDialog={({ open, editingId, readOnly, onClose, onSaved }) => (
          <CharacterTemplateEditDialog
            open={open}
            onClose={onClose}
            editingId={editingId}
            templateSetId={pack.id}
            ruleIdStr={pack.rule_id_str}
            onSave={onSaved}
            readOnly={readOnly}
          />
        )}
      />

      <ImportExistingTemplateDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        packId={pack.id}
        entityKind="player_character"
        onImported={() => void refetch()}
      />
    </>
  );
}
