'use client';

import { useMemo, useState } from 'react';
import { ScenarioEntityListShell } from './common/ScenarioEntityListShell';
import { ScenarioCharacterCard } from '../cards/CharacterCard';
import { CharacterEditDialog } from '../dialogs/CharacterEditDialog';
import { useScenario } from '../ScenarioContext';
import { useCharactersList } from '@/app/services/hooks/scenario/lists/useCharactersList';
import { useTabCountEffect } from './common/useTabCountEffect';
import { isLineageProtectedEntity } from '@/app/lib/launchedLineage';

function owned(character: { bound_user_id?: string | null }): boolean {
  return Boolean(character.bound_user_id);
}

export default function ScenarioCharactersList(props: {templatesToggle?: { checked: boolean; onCheckedChange: (v: boolean) => void };}) {
  const { scenarioId, setTabCount, canEditEntities, scenario } = useScenario();
  const { loading, error, items, refetch, removeById } = useCharactersList(scenarioId);
  const launched = Boolean(scenario?.is_session_snapshot);
  const [showFree, setShowFree] = useState(true);
  const [showOwned, setShowOwned] = useState(true);

  const visible = useMemo(() => {
    if (!launched) return items;
    return [...items]
      .filter((character) => (owned(character) ? showOwned : showFree))
      .sort((a, b) => Number(owned(a)) - Number(owned(b)));
  }, [items, launched, showFree, showOwned]);

  useTabCountEffect('characters', items.length, setTabCount);

  return (
    <ScenarioEntityListShell
      title="Персонажи"
      loading={loading}
      error={error ? String(error) : null}
      items={visible}
      refetch={refetch}
      readOnly={!canEditEntities}
      onDelete={(x: any) => removeById(String(x.id))}
      canDelete={(x) => !isLineageProtectedEntity(scenario, x)}
      itemGroup={launched ? (character) => (owned(character) ? 'Игроков' : 'Бесхозные') : undefined}
      customFilters={launched ? (
        <div className="flex gap-2">
          <FilterChip pressed={showFree} onClick={() => setShowFree((value) => !value)}>
            Бесхозные
          </FilterChip>
          <FilterChip pressed={showOwned} onClick={() => setShowOwned((value) => !value)}>
            Игроков
          </FilterChip>
        </div>
      ) : undefined}
      renderCard={({ item, onOpen, onDelete, readOnly }) => (
        <ScenarioCharacterCard
          key={String(item.id)}
          character={item}
          readOnly={readOnly}
          onEdit={(_, ro) => onOpen(ro ? 'view' : 'edit')}
          onDelete={onDelete}
        />
      )}
      renderDialog={({ open, editingId, readOnly, onClose, onSaved }) => (
        <CharacterEditDialog
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

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        pressed
          ? 'rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white'
          : 'rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-400'
      }
    >
      {children}
    </button>
  );
}
