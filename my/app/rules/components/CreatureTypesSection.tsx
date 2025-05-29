import React from 'react';
import { CreatureType, SkillGroup } from '@/app/rules/types';

interface CreatureTypesSectionProps {
  creatureTypes: CreatureType[];
  skillGroups: SkillGroup[];
  onEditCreature: (creature: CreatureType) => void;
  onDeleteCreature: (creatureId: string) => void;
  onAddCreature: () => void;
}

export default function CreatureTypesSection({ 
  creatureTypes, 
  skillGroups, 
  onEditCreature, 
  onDeleteCreature, 
  onAddCreature 
}: CreatureTypesSectionProps) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Типы существ</h2>
      {/* Временная заглушка - можно расширить позже */}
      <p className="text-gray-400">Функционал в разработке</p>
    </div>
  );
}
