'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import { filterMasterNotes } from '@/app/components/masterNotes/constants';
import type { MasterNoteEntityCatalog } from '@/app/components/masterNotes/types';
import type { Note } from '@/app/services/types2';
import { useScenario } from '@/app/components/scenarios/ScenarioContext';

type ScenarioMasterNotesContextValue = {
  masterNotes: Note[];
  catalog: MasterNoteEntityCatalog;
  scenarioId: string;
  reloadNotes: () => void;
};

const ScenarioMasterNotesContext = createContext<ScenarioMasterNotesContextValue | null>(null);

export function ScenarioMasterNotesProvider({ children }: React.PropsWithChildren) {
  const { scenarioId } = useScenario();
  const [notes, setNotes] = useState<Note[]>([]);
  const [npcs, setNpcs] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  const reloadNotes = useCallback(async () => {
    if (!scenarioId) return;
    const api = new ScenarioScopedApiService(scenarioId);
    const [n, npcList, itemList, charList, locList] = await Promise.all([
      api.getNotes(),
      api.getNpcs({ skip: 0, limit: 2000 }),
      api.getItemsWithOwner({ skip: 0, limit: 2000 }),
      api.getCharacters({ skip: 0, limit: 2000 }),
      api.getLocations({ skip: 0, limit: 2000 }),
    ]);
    setNotes(Array.isArray(n) ? n : []);
    setNpcs(Array.isArray(npcList) ? npcList : []);
    setItems(Array.isArray(itemList) ? itemList : []);
    setCharacters(Array.isArray(charList) ? charList : []);
    setLocations(Array.isArray(locList) ? locList : []);
  }, [scenarioId]);

  useEffect(() => {
    void reloadNotes();
  }, [reloadNotes]);

  const masterNotes = useMemo(() => filterMasterNotes(notes), [notes]);

  const catalog = useMemo<MasterNoteEntityCatalog>(
    () => ({
      npcs,
      items,
      characters,
      locations,
      notes: masterNotes,
    }),
    [npcs, items, characters, locations, masterNotes],
  );

  const value = useMemo(
    () => ({
      masterNotes,
      catalog,
      scenarioId: scenarioId ?? '',
      reloadNotes: () => void reloadNotes(),
    }),
    [masterNotes, catalog, scenarioId, reloadNotes],
  );

  if (!scenarioId) return <>{children}</>;

  return (
    <ScenarioMasterNotesContext.Provider value={value}>{children}</ScenarioMasterNotesContext.Provider>
  );
}

export function useScenarioMasterNotesScope(): ScenarioMasterNotesContextValue | null {
  return useContext(ScenarioMasterNotesContext);
}
