// dialogs/tabs/AddFromFactoryTab.tsx
'use client';

import React, { useMemo, useState } from 'react';
import type { Factory } from '@/app/services/types2';
import type { FactoryPickKind } from '../AddToSceneDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { FactoryPreviewPane } from './FactoryPreviewPane';

// сюда импортируешь компоненты просмотра
// import { NpcView } from '../NpcView';
// import { ItemView } from '../ItemView';
// import { CharacterView } from '../CharacterView';

interface Props {
  onPick?: (payload: {
    kind: FactoryPickKind;
    entityId: string;
  }) => void;
  fixedKind?: FactoryPickKind;
}

type ListItem = {
  entityId: string;
  kind: FactoryPickKind;
  name: string;
  // сам объект для превью
  raw: any;
};



export function AddFromFactoryTab({ onPick, fixedKind }: Props) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const { pluginUI, factories } = useSessionWebSocket(sessionId);

  const [kind, setKind] = useState<FactoryPickKind>(fixedKind ?? 'npc');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeKind = fixedKind ?? kind;

  const items = useMemo<ListItem[]>(() => {
    const needle = q.trim().toLowerCase();
    const out: ListItem[] = [];

    for (const fs of factories ?? []) {
      if (activeKind === 'npc') {
        for (const npc of fs.npcs ?? []) {
          const name = npc.name ?? '';
          if (!needle || name.toLowerCase().includes(needle)) {
            out.push({
              entityId: npc.id,
              kind: 'npc',
              name,
              raw: npc,
            });
          }
        }
      } else if (activeKind === 'item') {
        for (const item of fs.items ?? []) {
          const name = item.name ?? '';
          if (!needle || name.toLowerCase().includes(needle)) {
            out.push({
              entityId: item.id,
              kind: 'item',
              name,
              raw: item,
            });
          }
        }
      } else if (activeKind === 'character') {
        for (const ch of fs.characters ?? []) {
          const name = ch.name ?? '';
          if (!needle || name.toLowerCase().includes(needle)) {
            out.push({
              entityId: ch.id,
              kind: 'character',
              name,
              raw: ch,
            });
          }
        }
      }
    }

    return out;
  }, [factories, activeKind, q]);

  const selected = useMemo(
    () => items.find((it) => it.entityId === selectedId) ?? null,
    [items, selectedId],
  );

  return (
    <div className="flex gap-4 max-h-80">
      {/* Левая колонка: фильтр + список */}
      <div className="flex flex-col gap-3 w-1/2 min-w-[240px]">
        {!fixedKind ? (
          <div className="flex gap-2">
            <Button
              className={`px-2 py-1 text-sm rounded ${
                kind === 'npc' ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-400'
              }`}
              onClick={() => {
                setKind('npc');
                setSelectedId(null);
              }}
            >
              NPC
            </Button>
            <Button
              className={`px-2 py-1 text-sm rounded ${
                kind === 'item' ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-400'
              }`}
              onClick={() => {
                setKind('item');
                setSelectedId(null);
              }}
            >
              Предмет
            </Button>
            <Button
              className={`px-2 py-1 text-sm rounded ${
                kind === 'character' ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-400'
              }`}
              onClick={() => {
                setKind('character');
                setSelectedId(null);
              }}
            >
              Персонаж
            </Button>
          </div>
        ) : null}

        <Input
          placeholder="Поиск по имени…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
          }}
        />

        <div className="mt-2 max-h-56 overflow-auto flex flex-col gap-1 border border-zinc-800 rounded">
          {items.map((it) => {
            const active = it.entityId === selectedId;
            return (
              <div
                key={it.entityId}
                className={`flex items-center justify-between px-2 py-1 text-sm cursor-pointer ${
                  active ? 'bg-zinc-800' : 'hover:bg-zinc-900'
                }`}
                onClick={() => setSelectedId(it.entityId)}
              >
                <span className="truncate">{it.name || '(без имени)'}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPick?.({
                      kind: it.kind,
                      entityId: it.entityId,
                    });
                  }}
                >
                  Добавить
                </Button>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="text-xs text-zinc-500 px-2 py-1">
              Ничего не найдено
            </div>
          )}
        </div>
      </div>

      {/* Правая колонка: превью + правила */}
      <div className="flex-1 border border-zinc-800 rounded p-2 overflow-auto text-sm">
        <FactoryPreviewPane
          kind={selected?.kind ?? activeKind}
          item={selected?.raw ?? null}
          pluginUI={pluginUI}
        />
      </div>
    </div>
  );
}