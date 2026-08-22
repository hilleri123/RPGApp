'use client';

import React, { useMemo } from 'react';
import type { PlayerCharacterList } from '@/app/services/types2';
import { TYPE_COLORS, TYPE_ICONS } from '@/lib/constants';
import { ScenarioEntityCardShell } from './common/ScenarioEntityCardShell';
import { TemplatePackChip } from '@/app/components/entity-packs/TemplatePackChip';

export function ScenarioCharacterCard({
  character,
  onEdit,
  onDelete,
  readOnly = false,
  packChip,
}: {
  character: PlayerCharacterList;
  onEdit?: (character: PlayerCharacterList, readOnly: boolean) => void;
  onDelete?: (character: PlayerCharacterList) => Promise<void> | void;
  readOnly?: boolean;
  packChip?: { name: string; isPrimary?: boolean };
}) {
  const iconNode = (() => {
    if (character.img_url) {
      return (
        <div className="relative w-12 h-12 shrink-0">
          <img src={character.img_url} alt={character.name} className="w-12 h-12 object-cover rounded-lg shadow" />
          {character.icon_url ? (
            <div className="absolute top-1 right-1 z-10">
              <img src={character.icon_url} alt="" className="w-3 h-3 opacity-90" />
            </div>
          ) : (
            <div className="absolute top-1 right-1 z-10">
              <TYPE_ICONS.character className="w-3 h-3 opacity-90" color="rgba(255,255,255,0.95)" />
            </div>
          )}
          <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-md bg-black/45 backdrop-blur-[1px]" />
        </div>
      );
    }
    if (character.icon_url) {
      return <img src={character.icon_url} alt={character.name} className="w-10 h-10 object-contain rounded-md" />;
    }
    return <TYPE_ICONS.character color="#ffffff" className="w-8 h-8" />;
  })();

  const badges = useMemo(() => (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
      {packChip ? <TemplatePackChip name={packChip.name} isPrimary={packChip.isPrimary} /> : null}
      {character.location_id ? (
        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Есть локация</span>
      ) : (
        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-500">Без локации</span>
      )}
    </div>
  ), [packChip, character.location_id]);

  return (
    <ScenarioEntityCardShell
      accentColor={TYPE_COLORS.character}
      typeLabel="Персонаж"
      title={character.name}
      subtitle={character.short_desc}
      iconNode={iconNode}
      badges={badges}
      onView={onEdit ? () => onEdit(character, true) : undefined}
      onEdit={onEdit ? () => onEdit(character, false) : undefined}
      onDelete={onDelete ? () => onDelete(character) : undefined}
      readOnly={readOnly}
      todoProps={{ elementType: 'character', elementId: character.id, elementName: character.name }}
    />
  );
}