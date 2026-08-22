'use client';

import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { ScenarioCounterCard } from '../cards/CounterCard';
import { CounterEditDialog } from '../dialogs/CounterEditDialog';
import { useScenario } from '../ScenarioContext';
import { useCountersList } from '@/app/services/hooks/scenario/lists/useCountersList';
import { useTabCountEffect } from './common/useTabCountEffect';
import { isLineageProtectedEntity } from '@/app/lib/launchedLineage';
import { useScenarioFrontBadges } from '../hooks/useScenarioFrontBadges';

export default function ScenarioCountersList() {
  const { scenarioId, setTabCount, canEditEntities, scenario } = useScenario();
  const { loading, error, items, refetch, removeById } = useCountersList(scenarioId);
  const { fronts } = useScenarioFrontBadges(scenarioId);

  useTabCountEffect('counters', items.length, setTabCount);

  const openFront = (frontId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'fronts');
    url.searchParams.set('frontId', frontId);
    window.location.href = url.toString();
  };

  return (
    <ScenarioEntityListShell
      title="Счётчики"
      loading={loading}
      error={error ? String(error) : null}
      items={items}
      refetch={refetch}
      readOnly={!canEditEntities}
      onDelete={(x: any) => removeById(String(x.id))}
      canDelete={(x) => !isLineageProtectedEntity(scenario, x)}
      renderCard={({ item, onOpen, onDelete, readOnly }) => (
        <ScenarioCounterCard
          key={String(item.id)}
          counter={item}
          readOnly={readOnly}
          onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
          onDelete={onDelete}
          onChanged={() => void refetch()}
          frontBadges={fronts}
          onOpenFront={openFront}
        />
      )}
      renderDialog={({ open, editingId, readOnly, onClose, onSaved }) => (
        <CounterEditDialog
          open={open}
          onClose={onClose}
          editingId={editingId}
          onSave={onSaved}
          readOnly={readOnly}
        />
      )}
      getDeleteTitle={(x: any) => x.name ?? String(x.id)}
    />
  );
}
