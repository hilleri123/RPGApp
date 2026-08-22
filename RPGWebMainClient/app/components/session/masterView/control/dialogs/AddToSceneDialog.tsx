// AddToSceneDialog.tsx
'use client';

import React, { useState } from 'react';
import { EntityEditDialogShell } from '@/app/components/scenarios/dialogs/common/EntityEditDialogShell';
import type { AddKind } from '@/app/services/stores/masterUi';
import { AddToSceneCreateTab } from './tabs/AddToSceneCreateTab';
import { AddToSceneExistingTab } from './tabs/AddToSceneExistingTab';
import { AddFromFactoryTab } from './tabs/AddFromFactoryTab'; // новый таб
import type { Factory } from '@/app/services/types2'; // или откуда у тебя тип

export type FactoryPickKind = 'npc' | 'item' | 'character';

export interface AddToSceneDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (k: AddKind) => void;
  value: AddKind;

  onEditNpc?: (npc: any) => void;
  onViewNpc?: (npc: any) => void;
  onEditItem?: (item: any) => void;
  onViewItem?: (item: any) => void;

  factories?: Factory[]; // пришедшие сессией фабрики
  onPickFromFactory?: (payload: {
    kind: FactoryPickKind;
    // factoryId: string;
    entityId: string;
  }) => void;
}

export default function AddToSceneDialog({
  open,
  onClose,
  onPick,
  value,
  onEditNpc,
  onViewNpc,
  onEditItem,
  onViewItem,
  factories = [],
  onPickFromFactory,
}: AddToSceneDialogProps) {
  const [existingKind, setExistingKind] = useState<'npc' | 'item'>('npc');
  const [q, setQ] = useState('');

  return (
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title="Добавить…"
      loading={false}
      readOnly={false}
      disableSave={false}
      onSave={() => onPick(value)}
      tabs={[
        {
          key: 'create',
          title: 'Создать',
          content: <AddToSceneCreateTab value={value} onPick={onPick} />,
        },
        {
          key: 'existing',
          title: 'Существующее',
          content: (
            <AddToSceneExistingTab
              existingKind={existingKind}
              setExistingKind={setExistingKind}
              q={q}
              setQ={setQ}
              onEditNpc={onEditNpc}
              onViewNpc={onViewNpc}
              onEditItem={onEditItem}
              onViewItem={onViewItem}
            />
          ),
        },
        {
          key: 'factory',
          title: 'Из фабрики',
          content: (
            <AddFromFactoryTab
              onPick={onPickFromFactory}
            />
          ),
        },
      ]}
      rules={undefined}
    />
  );
}
