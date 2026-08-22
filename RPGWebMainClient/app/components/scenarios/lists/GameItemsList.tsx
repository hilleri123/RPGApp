'use client';

import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { ScenarioItemCard } from '../cards/ItemCard';
import { GameItemEditDialog } from '../dialogs/GameItemEditDialog';
import { useScenario } from '../ScenarioContext';
import { useGameItemsList } from '@/app/services/hooks/scenario/lists/useGameItemsList';
import { useTabCountEffect } from './common/useTabCountEffect';
import { isLineageProtectedEntity } from '@/app/lib/launchedLineage';
import type { GameItemWithOwnerShort } from '@/app/services/types2';
import { useScenarioFrontBadges } from '../hooks/useScenarioFrontBadges';

export default function ScenarioItemsList(props: {
  templatesToggle?: { checked: boolean; onCheckedChange: (v: boolean) => void };
}) {
  const { scenarioId, setTabCount, canEditEntities, scenario } = useScenario();
  const { loading, error, items, refetch, removeById } = useGameItemsList(scenarioId);
  const { fronts } = useScenarioFrontBadges(scenarioId);

  useTabCountEffect('items', items.length, setTabCount);

  const openFront = (frontId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'fronts');
    url.searchParams.set('frontId', frontId);
    window.location.href = url.toString();
  };

  return (
    <ScenarioEntityListShell<GameItemWithOwnerShort>
      title="Предметы"
      loading={loading}
      error={error ? String(error) : null}
      items={items}
      refetch={refetch}
      readOnly={!canEditEntities}
      onDelete={(x) => removeById(String(x.id))}
      canDelete={(x) => !isLineageProtectedEntity(scenario, x)}
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
  );
}
