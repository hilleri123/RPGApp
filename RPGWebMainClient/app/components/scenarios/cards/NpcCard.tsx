'use client';

import React, { useMemo } from 'react';
import type { NPCList, FrontBadgeInfo } from '@/app/services/types2';
import { getNpcStyle } from '@/lib/constants';
import { ScenarioEntityCardShell } from './common/ScenarioEntityCardShell';
import { TemplatePackChip } from '@/app/components/entity-packs/TemplatePackChip';
import { frontsForEntityTags } from './common/FrontRibbon';

export function ScenarioNpcCard({
  npc,
  onEdit,
  onDelete,
  readOnly = false,
  packChip,
  frontBadges,
  onOpenFront,
}: {
  npc: NPCList;
  onEdit?: (npc: NPCList, readOnly: boolean) => void;
  onDelete?: (npc: NPCList) => Promise<void> | void;
  readOnly?: boolean;
  packChip?: { name: string; isPrimary?: boolean };
  frontBadges?: FrontBadgeInfo[];
  onOpenFront?: (frontId: string) => void;
}) {
  const tags     = npc?.tags ?? [];
  const is_dead  = tags.includes('dead');
  const is_enemy = tags.includes('enemy');
  const style    = getNpcStyle(is_dead, is_enemy);
  const NpcIcon  = style.icon;

  const iconNode = (() => {
    if (npc.img_url) {
      return (
        <div className="relative w-12 h-12 shrink-0">
          <img src={npc.img_url} alt={npc.name} className="w-12 h-12 object-cover rounded-lg shadow" />
          {npc.icon_url ? (
            <div className="absolute top-1 right-1 z-10">
              <img src={npc.icon_url} alt="" className="w-3 h-3 opacity-90" />
            </div>
          ) : (
            <div className="absolute top-1 right-1 z-10">
              <NpcIcon className="w-3 h-3 opacity-90" color="rgba(255,255,255,0.95)" />
            </div>
          )}
          <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-md bg-black/45 backdrop-blur-[1px]" />
        </div>
      );
    }
    if (npc.icon_url) {
      return <img src={npc.icon_url} alt={npc.name} className="w-10 h-10 object-contain rounded-md" />;
    }
    return <NpcIcon color="#ffffff" className="w-8 h-8" />;
  })();

  const subtitle      = npc.description_for_players || npc.description_for_master;
  const exposureNames = npc.exposure_names ?? [];
  const exposureCount = exposureNames.length;

  const badges = useMemo(() => (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
      {packChip ? <TemplatePackChip name={packChip.name} isPrimary={packChip.isPrimary} /> : null}
      {is_enemy && (
        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Враг</span>
      )}
      {is_dead && (
        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Мёртв</span>
      )}
      {exposureCount > 0 && (
        <div className="relative group">
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/40 text-indigo-200 cursor-default">
            {exposureCount}
          </span>
          <div className="pointer-events-none absolute left-0 mt-1 z-20 hidden min-w-[180px] max-w-xs rounded-md border border-gray-700 bg-black/90 p-2 text-[11px] text-gray-100 shadow-lg group-hover:block">
            <ul className="space-y-0.5">
              {exposureNames.map((name) => (
                <li key={name} className="truncate">• {name}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  ), [packChip, is_enemy, is_dead, exposureCount, exposureNames]);

  return (
    <ScenarioEntityCardShell
      accentColor={style.color}
      typeLabel="NPC"
      title={npc.name}
      subtitleHtml={subtitle}
      iconNode={iconNode}
      badges={badges}
      onView={onEdit ? () => onEdit(npc, true) : undefined}
      onEdit={onEdit ? () => onEdit(npc, false) : undefined}
      onDelete={onDelete ? () => onDelete(npc) : undefined}
      readOnly={readOnly}
      todoProps={{ elementType: 'npc', elementId: npc.id, elementName: npc.name }}
      frontBadges={frontsForEntityTags(npc.tags, frontBadges ?? [])}
      onOpenFront={onOpenFront}
    />
  );
}