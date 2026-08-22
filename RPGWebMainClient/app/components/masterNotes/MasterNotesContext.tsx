'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { filterMasterNotes } from '@/app/components/masterNotes/constants';
import type { MasterNoteEntityCatalog } from '@/app/components/masterNotes/types';
import type { Note } from '@/app/services/types2';

type MasterNotesContextValue = {
  masterNotes: Note[];
  catalog: MasterNoteEntityCatalog;
  sessionId: string;
  scenarioId: string | null;
  reloadNotes: () => void;
};

const MasterNotesContext = createContext<MasterNotesContextValue | null>(null);

export function MasterNotesProvider({
  sessionId,
  children,
}: React.PropsWithChildren<{ sessionId: string }>) {
  const { notes, npcs, items, characters, locations, reloadSessionFields, session } =
    useSessionWebSocket(sessionId);

  const masterNotes = useMemo(() => filterMasterNotes(notes ?? []), [notes]);

  const catalog = useMemo<MasterNoteEntityCatalog>(
    () => ({
      npcs: npcs ?? [],
      items: items ?? [],
      characters: characters ?? [],
      locations: locations ?? [],
      notes: masterNotes,
    }),
    [npcs, items, characters, locations, masterNotes],
  );

  const value = useMemo(
    () => ({
      masterNotes,
      catalog,
      sessionId,
      scenarioId: session?.scenario_id ? String(session.scenario_id) : null,
      reloadNotes: () => reloadSessionFields(['notes']),
    }),
    [masterNotes, catalog, sessionId, session?.scenario_id, reloadSessionFields],
  );

  return <MasterNotesContext.Provider value={value}>{children}</MasterNotesContext.Provider>;
}

export function useMasterNotesContext(): MasterNoteEntityCatalog {
  const ctx = useContext(MasterNotesContext);
  if (!ctx) {
    return { npcs: [], items: [], characters: [], locations: [], notes: [] };
  }
  return ctx.catalog;
}

export function useMasterNotesScope(): MasterNotesContextValue | null {
  return useContext(MasterNotesContext);
}

export function useMasterNotesList(): Note[] {
  const ctx = useContext(MasterNotesContext);
  return ctx?.masterNotes ?? [];
}
