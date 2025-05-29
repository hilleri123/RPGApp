import React from 'react';
import { ItemTemplate } from '@/app/rules/types';

interface ItemTemplatesSectionProps {
  itemTemplates: ItemTemplate[];
  onEditTemplate: (template: ItemTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onAddTemplate: () => void;
}

export default function ItemTemplatesSection({ 
  itemTemplates, 
  onEditTemplate, 
  onDeleteTemplate, 
  onAddTemplate 
}: ItemTemplatesSectionProps) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Шаблоны предметов</h2>
      {/* Временная заглушка - можно расширить позже */}
      <p className="text-gray-400">Функционал в разработке</p>
    </div>
  );
}
