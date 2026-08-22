'use client';

import React from 'react';
import type { AddKind } from '@/app/services/stores/masterUi';

function KindButton({
  title,
  active,
  onClick,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        'px-3 py-2 rounded border text-sm text-left',
        active ? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-800 hover:bg-gray-800',
      ].join(' ')}
      onClick={onClick}
    >
      {title}
    </button>
  );
}

export function AddToSceneCreateTab({
  value,
  onPick,
}: {
  value: AddKind;
  onPick: (k: AddKind) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <KindButton title="NPC" active={value === 'npc'} onClick={() => onPick('npc')} />
      <KindButton title="Item" active={value === 'item'} onClick={() => onPick('item')} />
      <KindButton title="Obstacle" active={value === 'obstacle'} onClick={() => onPick('obstacle')} />
      <KindButton title="Note" active={value === 'note'} onClick={() => onPick('note')} />
      <KindButton title="Counter" active={value === 'counter'} onClick={() => onPick('counter')} />
    </div>
  );
}
