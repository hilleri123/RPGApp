// app/components/scenarios/dialogs/common/DialogModeContext.tsx
'use client';
import React, { createContext, useContext } from 'react';

type DialogMode = { readOnly: boolean };
const Ctx = createContext<DialogMode>({ readOnly: false });

export function DialogModeProvider({ readOnly, children }: React.PropsWithChildren<{ readOnly: boolean }>) {
  return <Ctx.Provider value={{ readOnly }}>{children}</Ctx.Provider>;
}

export function useDialogMode() {
  return useContext(Ctx);
}
