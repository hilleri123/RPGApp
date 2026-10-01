'use client';

import { useMemo, useState } from 'react';
import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { ScenarioItemCard } from '../cards/ItemCard';
import { GameItemEditDialog } from '../dialogs/GameItemEditDialog';
import { CreateItemFromTemplatePickerDialog } from '../dialogs/CreateItemFromTemplatePickerDialog';
import { useScenario } from '../ScenarioContext';
import { useGameItemsList } from '@/app/services/hooks/scenario/lists/useGameItemsList';
import { useTabCountEffect } from './common/useTabCountEffect';
import { isLineageProtectedEntity } from '@/app/lib/launchedLineage';
import type { GameItemWithOwnerShort } from '@/app/services/types2';
import type { GameItemTemplateSeed } from '@/app/services/hooks/scenario/dialogs/useGameItemDialog';
import { useScenarioFrontBadges } from '../hooks/useScenarioFrontBadges';
import {
  collectItemOwnerOptions,
  matchItemOwnerFilter,
} from './common/itemOwnerFilter';

export default function ScenarioItemsList(props: {
  templatesToggle?: { checked: boolean; onCheckedChange: (v: boolean) => void };
}) {
  const { scenarioId, setTabCount, canEditEntities, scenario } = useScenario();
  const { loading, error, items, refetch, removeById } = useGameItemsList(scenarioId);
  const { fronts } = useScenarioFrontBadges(scenarioId);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [seedFromTemplate, setSeedFromTemplate] = useState<GameItemTemplateSeed | null>(null);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('');

  useTabCountEffect('items', items.length, setTabCount);

  const ownerOptions = useMemo(() => collectItemOwnerOptions(items), [items]);

  const filteredByOwner = useMemo(() => {
    if (!ownerFilter) return items;
    return items.filter((it) => matchItemOwnerFilter(it.owner, ownerFilter));
  }, [items, ownerFilter]);

  const openFront = (frontId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'fronts');
    url.searchParams.set('frontId', frontId);
    window.location.href = url.toString();
  };

  const customFilters = (
    <>
      <select
        value={ownerFilter}
        onChange={(e) => setOwnerFilter(e.target.value)}
        className="rounded-md border border-gray-700 bg-black/40 text-gray-100 text-sm px-2 py-1.5 max-w-[240px]"
        title="Фильтр по владельцу"
      >
        <option value="">Все владельцы</option>
        {ownerOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {ownerFilter ? (
        <button
          type="button"
          onClick={() => setOwnerFilter('')}
          className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded border border-gray-700"
        >
          сбросить владельца
        </button>
      ) : null}
    </>
  );

  return (
    <>
      <ScenarioEntityListShell<GameItemWithOwnerShort>
        title="Предметы"
        loading={loading}
        error={error ? String(error) : null}
        items={filteredByOwner}
        refetch={refetch}
        readOnly={!canEditEntities}
        onDelete={(x) => removeById(String(x.id))}
        canDelete={(x) => !isLineageProtectedEntity(scenario, x)}
        onCreateFromTemplate={
          canEditEntities ? () => setTemplatePickerOpen(true) : undefined
        }
        customFilters={customFilters}
        renderCard={({ item, onOpen, onDelete, readOnly }) => (
          <ScenarioItemCard
            key={String(item.id)}
            item={item as any}
            readOnly={readOnly}
            onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
            onDelete={onDelete}
            frontBadges={fronts}
            onOpenFront={openFront}
          />
        )}
        renderDialog={({ open, editingId, readOnly, onClose, onSaved }) => (
          <GameItemEditDialog
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

      <CreateItemFromTemplatePickerDialog
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        scenarioId={scenarioId}
        defaultPackId={scenario?.template_set_id}
        onPick={(pick) => {
          setSeedFromTemplate({ templateId: pick.templateId, packId: pick.packId });
          setSeedDialogOpen(true);
        }}
      />

      <GameItemEditDialog
        open={seedDialogOpen}
        onClose={() => {
          setSeedDialogOpen(false);
          setSeedFromTemplate(null);
        }}
        editingId={null}
        seedFromTemplate={seedFromTemplate}
        onSave={() => void refetch()}
      />
    </>
  );
}
