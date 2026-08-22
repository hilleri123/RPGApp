import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { ScenarioNpcCard } from '../cards/NpcCard';
import { NpcEditDialog } from '../dialogs/NpcEditDialog';
import { useEffect, useRef } from 'react';
import { useScenario } from '../ScenarioContext';
import { useNpcsList } from '@/app/services/hooks/scenario/lists/useNpcsList';
import { isLineageProtectedEntity } from '@/app/lib/launchedLineage';
import { useScenarioFrontBadges } from '../hooks/useScenarioFrontBadges';

export default function ScenarioNpcsList(props: {templatesToggle?: { checked: boolean; onCheckedChange: (v: boolean) => void };}) {
  const { scenarioId, setTabCount, canEditEntities, scenario } = useScenario();
  const { loading, error, items, refetch, removeById } = useNpcsList(scenarioId);
  const { fronts } = useScenarioFrontBadges(scenarioId);

  const openFront = (frontId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'fronts');
    url.searchParams.set('frontId', frontId);
    window.location.href = url.toString();
  };

  const len = items.length;
  const prevLenRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevLenRef.current === len) return;
    prevLenRef.current = len;
    setTabCount('npcs', len);
  }, [len, setTabCount]);

  return (
    <ScenarioEntityListShell
      title="NPC"
      loading={loading}
      error={error ? String(error) : null}
      items={items}
      refetch={refetch}
      readOnly={!canEditEntities}
      onDelete={(npc) => removeById(npc.id)}
      canDelete={(npc) => !isLineageProtectedEntity(scenario, npc)}
      renderCard={({ item, onOpen, onDelete, readOnly }) => (
        <ScenarioNpcCard
          key={String(item.id)}
          npc={item}
          readOnly={readOnly}
          onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
          onDelete={onDelete}
          frontBadges={fronts}
          onOpenFront={openFront}
        />
      )}
      renderDialog={({ open, editingId, readOnly, onClose, onSaved }) => (
        <NpcEditDialog
          open={open}
          onClose={onClose}
          editingId={editingId}
          onSave={onSaved}
          readOnly={readOnly}
        />
      )}
      templatesToggle={props.templatesToggle}
    />
  );
}
