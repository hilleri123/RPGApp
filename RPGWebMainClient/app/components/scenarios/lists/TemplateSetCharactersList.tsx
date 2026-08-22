'use client';

import { useState } from 'react';
import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { ScenarioCharacterCard } from '../cards/CharacterCard';
import { useScenario } from '../ScenarioContext';
import { useTabCountEffect } from './common/useTabCountEffect';
import { CharacterTemplateEditDialog } from '../dialogs/CharacterTemplateEditDialog';
import { ImportExistingTemplateDialog } from '../dialogs/ImportExistingTemplateDialog';
import { useScenarioTemplateList } from '@/app/services/hooks/templates/lists/useScenarioTemplateList';
import { TemplatePackFilter } from './common/TemplatePackFilter';
import { useTemplatePackFilter } from './common/useTemplatePackFilter';
import { useScenarioLinkedPacks } from './common/useScenarioLinkedPacks';
import { templatePackChipFromItem } from './common/templatePackUtils';
import type { PlayerCharacterList } from '@/app/services/types2';
import type { ScenarioTemplateListItem } from '@/app/services/types2/template_entity';

type TemplateCharacterListItem = PlayerCharacterList & ScenarioTemplateListItem;

export default function TemplateSetCharactersList(props: {
  templatesToggle?: { checked: boolean; onCheckedChange: (v: boolean) => void };
}) {
  const { scenario, setTabCount, canEditEntities } = useScenario();
  const [importOpen, setImportOpen] = useState(false);

  if (!scenario) return <></>;

  const { loading, error, items, refetch, removeItem } = useScenarioTemplateList<TemplateCharacterListItem>({
    scenarioId: scenario.id,
    primaryPackId: scenario.template_set_id,
    entityKind: 'player_character',
    load: (api) => api.getTemplateCharacters({ skip: 0, limit: 1000 }),
    sort: (xs) => [...xs].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''))),
  });

  const { packOptions } = useScenarioLinkedPacks(scenario);
  const { packFilterId, setPackFilterId, filteredItems } = useTemplatePackFilter(items);

  useTabCountEffect('template_characters', items.length, setTabCount);

  return (
    <>
      <ScenarioEntityListShell<TemplateCharacterListItem>
        title="Персонажи (шаблоны)"
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
          <ScenarioCharacterCard
            key={String(item.id)}
            character={item}
            readOnly={readOnly}
            packChip={templatePackChipFromItem(item)}
            onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
            onDelete={onDelete}
          />
        )}
        renderDialog={({ open, editingId, templatePackId, readOnly, onClose, onSaved }) => (
          <CharacterTemplateEditDialog
            open={open}
            onClose={onClose}
            editingId={editingId}
            templateSetId={templatePackId ?? scenario.template_set_id}
            ruleIdStr={scenario.rule_id_str}
            onSave={onSaved}
            readOnly={readOnly}
          />
        )}
        getDeleteTitle={(x) => x.name ?? String(x.id)}
        templatesToggle={props.templatesToggle}
      />

      <ImportExistingTemplateDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        scenarioId={scenario.id}
        entityKind="player_character"
        onImported={() => void refetch()}
      />
    </>
  );
}
