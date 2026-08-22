'use client';

import React, { useMemo } from 'react';
import type { NPCList } from '@/app/services/types2';
import { useSceneExposures } from './SceneExposuresContext';
import { EntityPickerList } from './EntityPickerList';
import { ScenarioNpcCard } from '../../../cards/NpcCard';


function makeMap<T extends { id: string }>(xs: T[]) {
  const m: Record<string, T> = {};
  for (const x of xs) m[String(x.id)] = x;
  return m;
}

export function NpcPickerPanel(props: { npcOptions?: NPCList[] | null }) {
  const { readOnly, selected, addNpc, removeNpc } = useSceneExposures();
  const npcById = useMemo(() => makeMap(props.npcOptions ?? []), [props.npcOptions]);

  if (!selected) return null;

  return (
    <EntityPickerList
      title="NPC"
      readOnly={readOnly}
      searchOptions={props.npcOptions}
      addPlaceholder="Добавить NPC..."
      selected={selected.npcs}
      onPick={
        props.npcOptions
          ? (id) => addNpc(id ? (npcById[String(id)] as NPCList) ?? null : null)
          : undefined
      }
      onRemove={removeNpc}
      renderCard={({ item, onRemove }) => (
        <ScenarioNpcCard
          npc={item}
          onDelete={() => onRemove?.(item.id)}
        />
      )}
      getKey={(x) => x.id}
    />
  );
}
