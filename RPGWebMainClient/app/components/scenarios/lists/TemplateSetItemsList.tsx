'use client';

import { useState } from 'react';
import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { ScenarioItemCard } from '../cards/ItemCard';
import { useScenario } from '../ScenarioContext';
import { useTabCountEffect } from './common/useTabCountEffect';
import type { GameItemWithOwnerShort } from '@/app/services/types2';
import { GameItemTemplateEditDialog } from '../dialogs/GameItemTemplateEditDialog';
import { ImportExistingTemplateDialog } from '../dialogs/ImportExistingTemplateDialog';
import { useScenarioTemplateList } from '@/app/services/hooks/templates/lists/useScenarioTemplateList';
import { TemplatePackFilter } from './common/TemplatePackFilter';
import { useTemplatePackFilter } from './common/useTemplatePackFilter';
import { useScenarioLinkedPacks } from './common/useScenarioLinkedPacks';
import { templatePackChipFromItem } from './common/templatePackUtils';
import type { ScenarioTemplateListItem } from '@/app/services/types2/template_entity';

type TemplateItemListItem = GameItemWithOwnerShort & ScenarioTemplateListItem;

export default function TemplateSetItemsList(props: {
  templatesToggle?: { checked: boolean; onCheckedChange: (v: boolean) => void };
}) {
  const { scenario, setTabCount, canEditEntities } = useScenario();
  const [importOpen, setImportOpen] = useState(false);

  if (!scenario) return <></>;

  const { loading, error, items, refetch, removeItem } = useScenarioTemplateList<TemplateItemListItem>({
    scenarioId: scenario.id,
    primaryPackId: scenario.template_set_id,
    entityKind: 'game_item',
    load: (api) => api.getTemplateItems({ skip: 0, limit: 1000 }),
    sort: (xs) => [...xs].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''))),
  });

  const { packOptions } = useScenarioLinkedPacks(scenario);
  const { packFilterId, setPackFilterId, filteredItems } = useTemplatePackFilter(items);

  useTabCountEffect('template_items', items.length, setTabCount);

  return (
    <>
      <ScenarioEntityListShell<TemplateItemListItem>
        title="Предметы (шаблоны)"
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
        onDelete={(item) => removeItem(item)}
        renderCard={({ item, onOpen, onDelete, readOnly }) => (
          <ScenarioItemCard
            key={String(item.id)}
            item={item as any}
            readOnly={readOnly}
            packChip={templatePackChipFromItem(item)}
            onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
            onDelete={onDelete}
          />
        )}
        renderDialog={({ open, editingId, templatePackId, readOnly, onClose, onSaved }) => (
          <GameItemTemplateEditDialog
            open={open}
            onClose={onClose}
            editingId={editingId}
            templateSetId={templatePackId ?? scenario.template_set_id}
            ruleIdStr={scenario.rule_id_str}
            onSave={onSaved}
            readOnly={readOnly}
          />
        )}
        getDeleteTitle={(x: any) => x.name ?? String(x.id)}
        templatesToggle={props.templatesToggle}
      />

      <ImportExistingTemplateDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        scenarioId={scenario.id}
        entityKind="game_item"
        onImported={() => void refetch()}
      />
    </>
  );
}
