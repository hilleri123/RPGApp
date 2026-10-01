'use client';

import React, { useMemo } from 'react';
import type { LocationList } from '@/app/services/types2';
import { TYPE_COLORS, TYPE_ICONS } from '@/lib/constants';
import { ScenarioEntityCardShell } from './common/ScenarioEntityCardShell';
import { kindOfTags } from '@/app/lib/locationKinds';
import { SceneExposuresPreview } from './common/SceneExposuresPreview';

export function ScenarioLocationCard({
  location,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  location: LocationList;
  onEdit?: (location: LocationList, readOnly: boolean) => void;
  onDelete?: (location: LocationList) => Promise<void> | void;
  readOnly?: boolean;
}) {
  const iconNode = (() => {
    if (location.map_url) {
      return (
        <div className="relative w-12 h-12 shrink-0">
          <img
            src={location.map_url}
            alt={location.name}
            className="w-12 h-12 object-cover rounded-lg shadow"
          />

          {location.icon_url ? (
            <div className="absolute top-1 right-1 z-10">
              <img src={location.icon_url} alt="" className="w-3 h-3 opacity-90" />
            </div>
          ) : (
            <div className="absolute top-1 right-1 z-10">
              <TYPE_ICONS.location className="w-3 h-3 opacity-90" color="rgba(255,255,255,0.95)" />
            </div>
          )}

          <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-md bg-black/45 backdrop-blur-[1px]" />
        </div>
      );
    }

    if (location.icon_url) {
      return (
        <img
          src={location.icon_url}
          alt={location.name}
          className="w-10 h-10 object-contain rounded-md"
        />
      );
    }

    return <TYPE_ICONS.location color="#ffffff" className="w-8 h-8" />;
  })();

  const subtitle = location.description_for_players || location.description_for_master;

  const badges = useMemo(() => (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
      {kindOfTags(location.tags) && (
        <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-400/30 text-indigo-100">
          {kindOfTags(location.tags)!.emoji} {kindOfTags(location.tags)!.label}
        </span>
      )}
      {location.tags?.includes('start') && (
        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Стартовая</span>
      )}
      {location.parent_location_id && (
        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
          {location.parent_location_name || 'Есть родитель'}
        </span>
      )}
    </div>
  ), [location.tags, location.parent_location_id, location.parent_location_name]);

  return (
    <ScenarioEntityCardShell
      accentColor={TYPE_COLORS.location}
      typeLabel="Локация"
      title={location.name}
      subtitleHtml={subtitle}
      iconNode={iconNode}
      badges={badges}
      footer={<SceneExposuresPreview exposures={location.scene_exposures} />}
      onView={onEdit   ? () => onEdit(location, true)  : undefined}
      onEdit={onEdit   ? () => onEdit(location, false) : undefined}
      onDelete={onDelete ? () => onDelete(location)    : undefined}
      readOnly={readOnly}
      todoProps={{
        elementType: 'location',
        elementId:   location.id,
        elementName: location.name,
      }}
    />
  );
}