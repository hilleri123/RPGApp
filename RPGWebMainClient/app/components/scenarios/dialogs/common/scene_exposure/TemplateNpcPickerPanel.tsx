'use client';

import React, { useMemo } from 'react';
import type { NPCList, TemplateNPCLink } from '@/app/services/types2';
import { useSceneExposures } from './SceneExposuresContext';
import { EntityPickerList } from './EntityPickerList';
import { ScenarioNpcCard } from '../../../cards/NpcCard';

function makeMap<T extends { id: string }>(xs: T[]) {
  const m: Record<string, T> = {};
  for (const x of xs) m[String(x.id)] = x;
  return m;
}

export function TemplateNpcPickerPanel(props: { npcOptions?: NPCList[] | null }) {
  const { readOnly, selected, addTemplateNpc, removeTemplateNpc, setTemplateNpcQty } =
    useSceneExposures();
  const npcById = useMemo(() => makeMap(props.npcOptions ?? []), [props.npcOptions]);

  if (!selected) return null;

  const links = selected.template_npc_links ?? [];

  return (
    <EntityPickerList<TemplateNPCLink>   // ← явный дженерик после рефакторинга
      title="Шаблонные NPC"
      readOnly={readOnly}
      searchOptions={props.npcOptions}   // NPCList совместим с IdName если есть id+name
      addPlaceholder="Добавить шаблонный NPC..."
      selected={links}
      onPick={(id) =>
        addTemplateNpc(id ? (npcById[String(id)] as NPCList) ?? null : null)
      }
      onRemove={removeTemplateNpc}
      renderCard={({ item, onRemove }) => (
        <div className="space-y-1">
          <ScenarioNpcCard
            npc={item.template_npc}
            onDelete={() => onRemove?.(item.template_npc.id)}
          />
          <div className="flex items-center gap-2 px-2 pb-1">
            <span className="text-xs text-gray-400">Кол-во:</span>
            {readOnly ? (
              <span className="text-xs font-semibold text-gray-200">{item.qty}</span>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTemplateNpcQty(item.template_npc.id, item.qty - 1)}
                  disabled={item.qty <= 1}
                  className="w-5 h-5 flex items-center justify-center rounded border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-30 text-xs"
                >−</button>
                <span className="text-xs font-semibold text-gray-100 w-6 text-center tabular-nums">
                  {item.qty}
                </span>
                <button
                  type="button"
                  onClick={() => setTemplateNpcQty(item.template_npc.id, item.qty + 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-gray-600 text-gray-300 hover:bg-gray-700 text-xs"
                >+</button>
              </div>
            )}
          </div>
        </div>
      )}
      getKey={(x) => x.template_npc.id}
    />
  );
}