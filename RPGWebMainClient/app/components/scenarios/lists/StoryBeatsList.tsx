'use client';

import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { useScenario } from '../ScenarioContext';
import { useStoryBeatsList } from '@/app/services/hooks/scenario/lists/useStoryBeatsList';
import { ScenarioStoryBeatCard } from '../cards/StoryBeatCard';
import { StoryBeatEditDialog } from '../dialogs/StoryBeatEditDialog';
import { useTabCountEffect } from './common/useTabCountEffect';
import { isLineageProtectedEntity } from '@/app/lib/launchedLineage';
import { useScenarioFrontBadges } from '../hooks/useScenarioFrontBadges';

export default function ScenarioStoryBeatsList() {
  const { scenarioId, setTabCount, canEditEntities, scenario } = useScenario();
  const { loading, error, items, refetch, removeById } = useStoryBeatsList(scenarioId);
  const { fronts } = useScenarioFrontBadges(scenarioId);

  useTabCountEffect('story', items.length, setTabCount);

  const openFront = (frontId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'fronts');
    url.searchParams.set('frontId', frontId);
    window.location.href = url.toString();
  };

  return (
    <ScenarioEntityListShell
      title="Сюжетные биты"
      loading={loading}
      error={error ? String(error) : null}
      items={items}
      refetch={refetch}
      readOnly={!canEditEntities}
      onDelete={(x: any) => removeById(String(x.id))}
      canDelete={(x) => !isLineageProtectedEntity(scenario, x)}
      renderCard={({ item, onOpen, onDelete, readOnly }) => (
        <ScenarioStoryBeatCard
          key={String(item.id)}
          storyBeat={item}
          readOnly={readOnly}
          onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
          onDelete={onDelete}
          frontBadges={fronts}
          onOpenFront={openFront}
        />
      )}
      renderDialog={({ open, editingId, readOnly, onClose, onSaved }) => (
        <StoryBeatEditDialog
          open={open}
          onClose={onClose}
          editingId={editingId}
          onSave={onSaved}
          readOnly={readOnly}
        />
      )}
      getDeleteTitle={(x: any) => x.title ?? x.name ?? String(x.id)}
    />
  );
}
