'use client';

import { useState } from 'react';
import { useGameItemTemplatesList } from '@/app/services/hooks/templates/lists/useGameItemTemplatesList';
import { ScenarioEntityListShell } from '@/app/components/scenarios/lists/common/ScenarioEntityListShell';
import { ScenarioItemCard } from '@/app/components/scenarios/cards/ItemCard';
import { GameItemTemplateEditDialog } from '@/app/components/scenarios/dialogs/GameItemTemplateEditDialog';
import { ImportExistingTemplateDialog } from '@/app/components/scenarios/dialogs/ImportExistingTemplateDialog';
import type { EntityPack } from '@/app/services/api/entityPacks';

export function EntityPackItemsTab({ pack }: { pack: EntityPack }) {
  const [importOpen, setImportOpen] = useState(false);
  const { loading, error, items, refetch, removeById } = useGameItemTemplatesList(pack.id);

  return (
    <>
      <ScenarioEntityListShell
        title="Предметы (шаблоны пака)"
        loading={loading}
        error={error ? String(error) : null}
        items={items}
        refetch={refetch}
        onDelete={(item) => removeById(String(item.id))}
        onImportExisting={() => setImportOpen(true)}
        importExistingLabel="Добавить существующий"
        renderCard={({ item, onOpen, onDelete, readOnly }) => (
          <ScenarioItemCard
            key={String(item.id)}
            item={item as any}
            readOnly={readOnly}
            packChip={{ name: pack.name, isPrimary: true }}
            onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
            onDelete={onDelete}
          />
        )}
        renderDialog={({ open, editingId, readOnly, onClose, onSaved }) => (
          <GameItemTemplateEditDialog
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
        entityKind="game_item"
        onImported={() => void refetch()}
      />
    </>
  );
}
