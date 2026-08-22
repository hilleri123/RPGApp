'use client';

import { useState } from 'react';
import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { ScenarioNpcCard } from '../cards/NpcCard';
import { useEffect, useRef } from 'react';
import { useScenario } from '../ScenarioContext';
import { NpcTemplateEditDialog } from '../dialogs/NpcTemplateEditDialog';
import { ImportExistingTemplateDialog } from '../dialogs/ImportExistingTemplateDialog';
import { useScenarioTemplateList } from '@/app/services/hooks/templates/lists/useScenarioTemplateList';
import { TemplatePackFilter } from './common/TemplatePackFilter';
import { useTemplatePackFilter } from './common/useTemplatePackFilter';
import { useScenarioLinkedPacks } from './common/useScenarioLinkedPacks';
import { templatePackChipFromItem } from './common/templatePackUtils';
import type { NPCList } from '@/app/services/types2';
import type { ScenarioTemplateListItem } from '@/app/services/types2/template_entity';

type TemplateNpcListItem = NPCList & ScenarioTemplateListItem;

export default function TemplateSetNpcsList(props: {
  templatesToggle?: { checked: boolean; onCheckedChange: (v: boolean) => void };
}) {
  const { scenario, setTabCount, canEditEntities } = useScenario();
  const [importOpen, setImportOpen] = useState(false);

  if (!scenario) {
    return <></>;
  }

  const { loading, error, items, refetch, removeItem } = useScenarioTemplateList<TemplateNpcListItem>({
    scenarioId: scenario.id,
    primaryPackId: scenario.template_set_id,
    entityKind: 'npc',
    load: (api) => api.getTemplateNpcs({ skip: 0, limit: 1000 }),
    sort: (xs) => [...xs].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''))),
  });

  const { packOptions } = useScenarioLinkedPacks(scenario);
  const { packFilterId, setPackFilterId, filteredItems } = useTemplatePackFilter(items);

  const len = items.length;
  const prevLenRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevLenRef.current === len) return;
    prevLenRef.current = len;
    setTabCount('template_npcs', len);
  }, [len, setTabCount]);

  return (
    <>
      <ScenarioEntityListShell<TemplateNpcListItem>
        title="NPC (шаблоны)"
        loading={loading}
        error={error ? String(error) : null}
        items={filteredItems}
        refetch={refetch}
        readOnly={!canEditEntities}
        onImportExisting={canEditEntities ? () => setImportOpen(true) : undefined}
        importExistingLabel="Добавить существующий"
        customFilters={
          <TemplatePackFilter
            value={packFilterId}
            onChange={setPackFilterId}
            packs={packOptions}
          />
        }
        getTemplatePackId={(item) => item.template_pack_id ?? scenario.template_set_id}
        canDelete={(item) => Boolean(item.can_delete || item.can_unlink)}
        getDeleteDescription={(item) =>
          item.can_unlink && !item.can_delete
            ? `Убрать шаблон “${item.name}” из этого сценария? Сам шаблон останется в своём паке.`
            : `Удалить шаблон “${item.name}” из основного пака? Это действие нельзя отменить.`
        }
        onDelete={(npc) => removeItem(npc)}
        renderCard={({ item, onOpen, onDelete, readOnly }) => (
          <ScenarioNpcCard
            key={String(item.id)}
            npc={item}
            readOnly={readOnly}
            packChip={templatePackChipFromItem(item)}
            onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
            onDelete={onDelete}
          />
        )}
        renderDialog={({ open, editingId, templatePackId, readOnly, onClose, onSaved }) => (
          <NpcTemplateEditDialog
            open={open}
            onClose={onClose}
            editingId={editingId}
            templateSetId={templatePackId ?? scenario.template_set_id}
            ruleIdStr={scenario.rule_id_str}
            onSave={onSaved}
            readOnly={readOnly}
          />
        )}
        templatesToggle={props.templatesToggle}
      />

      <ImportExistingTemplateDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        scenarioId={scenario.id}
        entityKind="npc"
        onImported={() => void refetch()}
      />
    </>
  );
}
