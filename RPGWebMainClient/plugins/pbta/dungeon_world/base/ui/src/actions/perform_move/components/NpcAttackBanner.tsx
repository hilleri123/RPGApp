'use client';

import React from 'react';
import { Swords } from 'lucide-react';

/**
 * NPC-«повод» хода и его атака. Показывается на всех стадиях хода, чтобы при заявках
 * на урон мастер видел, какой атакой действует NPC.
 */
export function NpcAttackBanner({ entry }: { entry: any }) {
  const npcId = String(entry?.source_npc_id ?? '');
  if (!npcId) return null;
  const name = String(entry?.source_npc_name || 'NPC');
  const attack = entry?.npc_attack ?? null;
  const tags: string[] = [...(attack?.range_tags ?? []), ...(attack?.attack_tags ?? [])];

  return (
    <div className="mb-3 flex items-start gap-2 rounded border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm">
      <Swords className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
      <div className="min-w-0">
        <div className="text-rose-100">
          <span className="font-medium">{name}</span>
          {attack ? (
            <>
              {' '}атакует: <span className="font-medium">{attack.name}</span>
              {attack.damage ? <span className="text-rose-200/80"> · {attack.damage}</span> : null}
            </>
          ) : (
            ' заставляет действовать'
          )}
        </div>
        {tags.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="rounded border border-rose-400/30 px-1.5 text-xs text-rose-200/80">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
