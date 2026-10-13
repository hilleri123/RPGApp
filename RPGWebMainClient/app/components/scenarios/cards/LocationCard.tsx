'use client';

import React, { useMemo } from 'react';
import type { LocationList } from '@/app/services/types2';
import { TYPE_COLORS, TYPE_ICONS } from '@/lib/constants';
import { ScenarioEntityCardShell } from './common/ScenarioEntityCardShell';
import { kindOfTags } from '@/app/lib/locationKinds';
import { SceneExposuresPreview } from './common/SceneExposuresPreview';
import { locationHasMapPreview, LocationMapThumb } from './LocationMapThumb';

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
    if (locationHasMapPreview(location)) {
      return <LocationMapThumb location={location} />;
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