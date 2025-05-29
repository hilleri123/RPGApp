import React from 'react';
import { Pencil, Trash2, Plus, Hash, Type, ToggleLeft, List } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PropertyTemplate } from '@/app/rules/types';

interface PropertyTemplatesProps {
  propertyTemplates: PropertyTemplate[];
  onEditProperty: (property: PropertyTemplate) => void;
  onDeleteProperty: (propertyId: string) => void;
  onAddProperty: () => void;
}

const TYPE_ICONS = {
  number: Hash,
  text: Type,
  boolean: ToggleLeft,
  select: List
};

const TYPE_LABELS = {
  number: 'Число',
  text: 'Текст',
  boolean: 'Да/Нет',
  select: 'Выбор'
};

const CATEGORY_LABELS = {
  attributes: 'Атрибуты',
  skills: 'Навыки',
  equipment: 'Снаряжение',
  status: 'Состояние',
  other: 'Прочее'
};

const CATEGORY_COLORS = {
  attributes: 'bg-green-500',
  skills: 'bg-blue-500',
  equipment: 'bg-purple-500',
  status: 'bg-orange-500',
  other: 'bg-gray-500'
};

export default function PropertyTemplates({ 
  propertyTemplates, 
  onEditProperty, 
  onDeleteProperty, 
  onAddProperty 
}: PropertyTemplatesProps) {
  
  // Группируем шаблоны по категориям
  const groupedTemplates = React.useMemo(() => {
    const groups: Record<string, PropertyTemplate[]> = {};
    
    propertyTemplates.forEach(template => {
      if (!groups[template.category]) {
        groups[template.category] = [];
      }
      groups[template.category].push(template);
    });
    
    return groups;
  }, [propertyTemplates]);

  const formatDefaultValue = (template: PropertyTemplate) => {
    if (template.type === 'boolean') {
      return template.defaultValue ? 'Да' : 'Нет';
    }
    if (template.type === 'select' && template.options) {
      return template.options.includes(String(template.defaultValue)) 
        ? String(template.defaultValue) 
        : template.options[0] || '';
    }
    return String(template.defaultValue);
  };

  const renderPropertyCard = (template: PropertyTemplate) => {
    const TypeIcon = TYPE_ICONS[template.type];
    
    return (
      <div
        key={template.id}
        className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-white font-medium text-sm truncate">
                {template.name}
              </h4>
              {template.required && (
                <Badge variant="secondary" className="text-xs bg-red-600 text-white">
                  Обязательно
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <TypeIcon className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 text-xs">
                {TYPE_LABELS[template.type]}
              </span>
              
              {template.type === 'number' && template.min !== undefined && template.max !== undefined && (
                <span className="text-gray-500 text-xs">
                  ({template.min}-{template.max})
                </span>
              )}
            </div>

            {template.description && (
              <p className="text-gray-400 text-xs mb-2 line-clamp-2">
                {template.description}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">По умолчанию:</span>
              <span className="text-gray-300">
                {formatDefaultValue(template)}
              </span>
            </div>

            {template.type === 'select' && template.options && template.options.length > 0 && (
              <div className="mt-2">
                <span className="text-gray-500 text-xs">Варианты: </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {template.options.slice(0, 3).map((option, index) => (
                    <Badge key={index} variant="outline" className="text-xs border-gray-600 text-gray-300">
                      {option}
                    </Badge>
                  ))}
                  {template.options.length > 3 && (
                    <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                      +{template.options.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => onEditProperty(template)}
              className="p-1 rounded text-gray-400 hover:text-blue-400 hover:bg-gray-700 transition-colors"
              title="Редактировать свойство"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDeleteProperty(template.id)}
              className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
              title="Удалить свойство"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Шаблоны свойств</h2>
          <p className="text-gray-400">
            Создавайте переиспользуемые шаблоны свойств для персонажей
          </p>
        </div>
        
        <Button
          onClick={onAddProperty}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Добавить шаблон
        </Button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const count = groupedTemplates[key]?.length || 0;
          const colorClass = CATEGORY_COLORS[key as keyof typeof CATEGORY_COLORS];
          
          return (
            <div key={key} className="bg-gray-800 rounded-lg border border-gray-700 p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full ${colorClass}`} />
                <span className="text-gray-300 text-sm font-medium">{label}</span>
              </div>
              <span className="text-white text-lg font-bold">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Группы шаблонов */}
      {Object.keys(groupedTemplates).length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-medium text-gray-400 mb-2">Шаблоны свойств не найдены</h3>
            <p className="text-gray-500 mb-4">Создайте первый шаблон свойства для начала работы</p>
            
            <Button
              onClick={onAddProperty}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать шаблон
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(CATEGORY_LABELS).map(([categoryKey, categoryLabel]) => {
            const templates = groupedTemplates[categoryKey];
            if (!templates || templates.length === 0) return null;
            
            const colorClass = CATEGORY_COLORS[categoryKey as keyof typeof CATEGORY_COLORS];
            
            return (
              <div key={categoryKey} className="space-y-4">
                <div className={`${colorClass} rounded-lg p-4`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{categoryLabel}</h3>
                    <span className="text-white/80 text-sm">
                      {templates.length} {templates.length === 1 ? 'шаблон' : 'шаблонов'}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map(renderPropertyCard)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { PropertyTemplatesProps };
