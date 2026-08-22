'use client';

import { useCallback, useState } from 'react';

export type EntityDialogMeta = {
  canOpenData?: boolean;
  onOpenData?: () => void;
  canCloseData?: boolean;
  onCloseData?: () => void;
  sceneId?: string;
};

type EntityDialogState = { entity: any; readOnly: boolean; meta?: EntityDialogMeta } | null;

export function useSessionEntityDialogs() {
  const [npcDlg, setNpcDlg] = useState<EntityDialogState>(null);
  const [itemDlg, setItemDlg] = useState<EntityDialogState>(null);
  const [characterDlg, setCharacterDlg] = useState<EntityDialogState>(null);
  const [obstacleDlg, setObstacleDlg] = useState<EntityDialogState>(null);

  const openNpc = useCallback((entity: any, readOnly: boolean, meta?: EntityDialogMeta) => {
    setNpcDlg({ entity, readOnly, meta });
  }, []);

  const openItem = useCallback((entity: any, readOnly: boolean, meta?: EntityDialogMeta) => {
    setItemDlg({ entity, readOnly, meta });
  }, []);

  const openCharacter = useCallback((entity: any, readOnly: boolean, meta?: EntityDialogMeta) => {
    setCharacterDlg({ entity, readOnly, meta });
  }, []);

  const openObstacle = useCallback((entity: any, readOnly: boolean) => {
    setObstacleDlg({ entity, readOnly });
  }, []);

  return {
    npcDlg,
    itemDlg,
    characterDlg,
    obstacleDlg,
    setNpcDlg,
    setItemDlg,
    setCharacterDlg,
    setObstacleDlg,
    openNpc,
    openItem,
    openCharacter,
    openObstacle,
    viewNpc: (entity: any, meta?: EntityDialogMeta) => openNpc(entity, true, meta),
    editNpc: (entity: any) => openNpc(entity, false),
    viewItem: (entity: any, meta?: EntityDialogMeta) => openItem(entity, true, meta),
    editItem: (entity: any) => openItem(entity, false),
    viewCharacter: (entity: any, meta?: EntityDialogMeta) => openCharacter(entity, true, meta),
    editCharacter: (entity: any) => openCharacter(entity, false),
    viewObstacle: (entity: any) => openObstacle(entity, true),
    editObstacle: (entity: any) => openObstacle(entity, false),
  };
}
