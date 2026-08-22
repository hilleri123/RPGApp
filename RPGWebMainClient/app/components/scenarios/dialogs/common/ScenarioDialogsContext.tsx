// app/components/scenarios/dialogs/common/ScenarioDialogsContext.tsx
'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type DialogMode = 'view' | 'edit';

export type OpenDialogParams = {
  id: string | null;        // null => create
  mode?: DialogMode;        // default 'edit'
};

export type ScenarioDialogsContextValue = {
  open: boolean;
  entity: 'item' | 'npc' | 'character' | 'location' | 'note' | 'counter' | 'storyBeat' | null;
  editingId: string | null;
  readOnly: boolean;

  openDialog: (entity: NonNullable<ScenarioDialogsContextValue['entity']>, p: OpenDialogParams) => void;
  closeDialog: () => void;
};

const Ctx = createContext<ScenarioDialogsContextValue | null>(null);

export function ScenarioDialogsProvider({ children }: React.PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const [entity, setEntity] = useState<ScenarioDialogsContextValue['entity']>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  const openDialog = useCallback((e: NonNullable<ScenarioDialogsContextValue['entity']>, p: OpenDialogParams) => {
    setEntity(e);
    setEditingId(p.id);
    setReadOnly((p.mode ?? 'edit') === 'view');
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setEntity(null);
    setEditingId(null);
    setReadOnly(false);
  }, []);

  const value = useMemo(
    () => ({ open, entity, editingId, readOnly, openDialog, closeDialog }),
    [open, entity, editingId, readOnly, openDialog, closeDialog]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScenarioDialogs() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useScenarioDialogs must be used within ScenarioDialogsProvider');
  return v;
}
