'use client';

import { useState } from 'react';
import { useNpcTemplatesList } from '@/app/services/hooks/templates/lists/useNpcTemplatesList';
import { ScenarioEntityListShell } from '@/app/components/scenarios/lists/common/ScenarioEntityListShell';
import { ScenarioNpcCard } from '@/app/components/scenarios/cards/NpcCard';
import { NpcTemplateEditDialog } from '@/app/components/scenarios/dialogs/NpcTemplateEditDialog';
import { ImportExistingTemplateDialog } from '@/app/components/scenarios/dialogs/ImportExistingTemplateDialog';
import type { EntityPack } from '@/app/services/api/entityPacks';

export function EntityPackNpcsTab({ pack }: { pack: EntityPack }) {
  const [importOpen, setImportOpen] = useState(false);
  const { loading, error, items, refetch, removeById } = useNpcTemplatesList(pack.id);

  return (
    <>
      <ScenarioEntityListShell
        title="NPC (шаблоны пака)"
        loading={loading}
        error={error ? String(error) : null}
        items={items}
        refetch={refetch}
        onDelete={(npc) => removeById(String(npc.id))}
        onImportExisting={() => setImportOpen(true)}
        importExistingLabel="Добавить существующий"
        renderCard={({ item, onOpen, onDelete, readOnly }) => (
          <ScenarioNpcCard
            key={String(item.id)}
            npc={item}
            readOnly={readOnly}
            packChip={{ name: pack.name, isPrimary: true }}
            onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
            onDelete={onDelete}
          />
        )}
        renderDialog={({ open, editingId, readOnly, onClose, onSaved }) => (
          <NpcTemplateEditDialog
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
        entityKind="npc"
        onImported={() => void refetch()}
      />
    </>
  );
}
