'use client';

import React, { useMemo } from 'react';
import type { GameItemWithOwnerShort, FrontBadgeInfo } from '@/app/services/types2';
import { TYPE_COLORS, TYPE_ICONS } from '@/lib/constants';
import { ScenarioEntityCardShell } from './common/ScenarioEntityCardShell';
import { TemplatePackChip } from '@/app/components/entity-packs/TemplatePackChip';
import { frontsForEntityTags } from './common/FrontRibbon';

export function ScenarioItemCard({
  item,
  onEdit,
  onDelete,
  readOnly = false,
  packChip,
  frontBadges,
  onOpenFront,
}: {
  item: GameItemWithOwnerShort;
  onEdit?: (item: GameItemWithOwnerShort, readOnly: boolean) => void;
  onDelete?: (item: GameItemWithOwnerShort) => Promise<void> | void;
  readOnly?: boolean;
  packChip?: { name: string; isPrimary?: boolean };
  frontBadges?: FrontBadgeInfo[];
  onOpenFront?: (frontId: string) => void;
}) {
  const iconNode = (() => {
    if (item.img_url) {
      return (
        <div className="relative w-12 h-12 shrink-0">
          <img src={item.img_url} alt={item.name} className="w-12 h-12 object-cover rounded-lg shadow" />
          {item.icon_url ? (
            <div className="absolute top-1 right-1 z-10">
              <img src={item.icon_url} alt="" className="w-3 h-3 opacity-90" />
            </div>
          ) : (
            <div className="absolute top-1 right-1 z-10">
              <TYPE_ICONS.item className="w-3 h-3 opacity-90" color="rgba(255,255,255,0.95)" />
            </div>
          )}
          <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-md bg-black/45 backdrop-blur-[1px]" />
        </div>
      );
    }
    if (item.icon_url) {
      return <img src={item.icon_url} alt={item.name} className="w-10 h-10 object-contain rounded-md" />;
    }
    return <TYPE_ICONS.item color="#ffffff" className="w-8 h-8" />;
  })();

  const ownerLabel = useMemo(() => {
    if (!item.owner) return null;
    const t =
      item.owner.type === 'npc'       ? 'NPC' :
      item.owner.type === 'character' ? 'Персонаж' : 'Предмет';
    return `${t}: ${item.owner.name}`;
  }, [item.owner]);

  const exposureNames  = item.exposure_names ?? [];
  const exposureCount  = exposureNames.length;

  const badges = (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
      {packChip ? <TemplatePackChip name={packChip.name} isPrimary={packChip.isPrimary} /> : null}
      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
        {item.owner ? `У: ${ownerLabel}` : 'Свободен'}
      </span>
      {item.owner?.icon_url && (
        <img src={item.owner.icon_url} alt="" className="w-4 h-4 rounded-sm opacity-90" />
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
  );

  return (
    <ScenarioEntityCardShell
      accentColor={TYPE_COLORS.item}
      typeLabel="Предмет"
      title={item.name}
      subtitleHtml={item.description_for_players || item.description_for_master}
      iconNode={iconNode}
      badges={badges}
      onView={onEdit ? () => onEdit(item, true) : undefined}
      onEdit={onEdit ? () => onEdit(item, false) : undefined}
      onDelete={onDelete ? () => onDelete(item) : undefined}
      readOnly={readOnly}
      todoProps={{ elementType: 'item', elementId: item.id, elementName: item.name }}
      frontBadges={frontsForEntityTags(item.tags, frontBadges ?? [])}
      onOpenFront={onOpenFront}
    />
  );
}