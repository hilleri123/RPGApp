"use client"

import { useState } from "react"
import React from 'react';
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"

// Импорт созданных компонентов
import RulesHeader from './components/RulesHeader'
import SkillGroups from './components/SkillGroups'
import SkillModal from './components/SkillModal'
import PropertyTemplates from './components/PropertyTemplates'
import PropertyModal from './components/PropertyModal'
import ItemTemplatesSection from './components/ItemTemplatesSection'
import CreatureTypesSection from './components/CreatureTypesSection'

// Импорт типов
import { 
  Skill, 
  SkillGroup, 
  PropertyTemplate, 
  ItemTemplate, 
  CreatureType 
} from './types'

// Исходные данные
const initialSkillGroups: SkillGroup[] = [
  {
    id: "combat",
    name: "Боевые навыки",
    color: "bg-red-500",
    skills: [
      { id: "attack", name: "Атака", description: "Способность наносить урон" },
      { id: "defense", name: "Защита", description: "Способность уклоняться от атак" },
      { id: "precision", name: "Точность", description: "Способность наносить критический урон" },
    ],
  },
  {
    id: "magic",
    name: "Магические навыки",
    color: "bg-blue-500",
    skills: [
      { id: "fire", name: "Огненная магия", description: "Контроль над огнём" },
      { id: "water", name: "Водная магия", description: "Контроль над водой" },
      { id: "healing", name: "Исцеление", description: "Способность лечить раны" },
    ],
  },
  {
    id: "social",
    name: "Социальные навыки",
    color: "bg-green-500",
    skills: [
      { id: "persuasion", name: "Убеждение", description: "Способность убеждать других" },
      { id: "intimidation", name: "Запугивание", description: "Способность вселять страх" },
      { id: "deception", name: "Обман", description: "Способность лгать убедительно" },
    ],
  },
];

const initialPropertyTemplates: PropertyTemplate[] = [
  {
    id: "strength",
    name: "Сила",
    description: "Физическая мощь персонажа",
    type: "number",
    defaultValue: 10,
    min: 1,
    max: 20,
    required: true,
    category: "attributes"
  },
  {
    id: "health_status",
    name: "Состояние здоровья",
    description: "Текущее состояние персонажа",
    type: "select",
    defaultValue: "Здоров",
    options: ["Здоров", "Ранен", "Тяжело ранен", "При смерти"],
    required: true,
    category: "status"
  }
];

const initialItemTemplates: ItemTemplate[] = [
  {
    id: "weapon",
    name: "Оружие",
    icon: "Sword",
    properties: [
      { name: "damage", label: "Урон", type: "number" },
      { name: "range", label: "Дальность", type: "select", options: ["Ближняя", "Средняя", "Дальняя"] },
      { name: "weight", label: "Вес", type: "number" },
    ],
  },
  {
    id: "armor",
    name: "Броня",
    icon: "Shield",
    properties: [
      { name: "protection", label: "Защита", type: "number" },
      { name: "mobility", label: "Подвижность", type: "select", options: ["Низкая", "Средняя", "Высокая"] },
      { name: "weight", label: "Вес", type: "number" },
    ],
  },
];

const initialCreatureTypes: CreatureType[] = [
  {
    id: "humanoid",
    name: "Гуманоид",
    description: "Человекоподобные существа",
    skillValues: [
      { skillId: "attack", baseValue: 5 },
      { skillId: "defense", baseValue: 5 },
      { skillId: "persuasion", baseValue: 7 },
    ],
  },
  {
    id: "beast",
    name: "Зверь",
    description: "Дикие животные и чудовища",
    skillValues: [
      { skillId: "attack", baseValue: 8 },
      { skillId: "defense", baseValue: 4 },
      { skillId: "intimidation", baseValue: 6 },
    ],
  },
];

export default function RulesPage() {
  // Основное состояние
  const [skillGroups, setSkillGroups] = useState<SkillGroup[]>(initialSkillGroups)
  const [propertyTemplates, setPropertyTemplates] = useState<PropertyTemplate[]>(initialPropertyTemplates)
  const [itemTemplates, setItemTemplates] = useState<ItemTemplate[]>(initialItemTemplates)
  const [creatureTypes, setCreatureTypes] = useState<CreatureType[]>(initialCreatureTypes)

  // Состояние модальных окон
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false)
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [editingSkillGroupId, setEditingSkillGroupId] = useState<string>('')
  const [editingProperty, setEditingProperty] = useState<PropertyTemplate | null>(null)

  // Состояние поиска
  const [searchQuery, setSearchQuery] = useState('')

  // Обработчики для навыков
  const handleSaveSkill = (skillData: {
    id?: string;
    name: string;
    description: string;
    groupId: string;
  }) => {
    if (skillData.id) {
      // Редактирование существующего навыка
      setSkillGroups(skillGroups.map(group => {
        if (group.id === skillData.groupId) {
          return {
            ...group,
            skills: group.skills.map(skill =>
              skill.id === skillData.id ? {
                id: skill.id,
                name: skillData.name,
                description: skillData.description
              } : skill
            )
          };
        }
        return group;
      }));
    } else {
      // Добавление нового навыка
      const newSkillId = skillData.name.toLowerCase().replace(/\s+/g, '-');
      setSkillGroups(skillGroups.map(group => {
        if (group.id === skillData.groupId) {
          return {
            ...group,
            skills: [...group.skills, {
              id: newSkillId,
              name: skillData.name,
              description: skillData.description
            }]
          };
        }
        return group;
      }));
    }
  };

  const handleEditSkill = (skill: Skill, groupId: string) => {
    setEditingSkill(skill);
    setEditingSkillGroupId(groupId);
    setIsSkillModalOpen(true);
  };

  const handleDeleteSkill = (skillId: string, groupId: string) => {
    setSkillGroups(skillGroups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          skills: group.skills.filter(skill => skill.id !== skillId)
        };
      }
      return group;
    }));
  };

  const handleAddSkill = (groupId: string) => {
    setEditingSkill(null);
    setEditingSkillGroupId(groupId);
    setIsSkillModalOpen(true);
  };

  // Обработчики для свойств
  const handleSaveProperty = (propertyData: Omit<PropertyTemplate, 'id'> & { id?: string }) => {
    if (propertyData.id) {
      // Редактирование существующего свойства
      setPropertyTemplates(propertyTemplates.map(property =>
        property.id === propertyData.id ? { ...propertyData, id: propertyData.id } : property
      ));
    } else {
      // Добавление нового свойства
      const newPropertyId = propertyData.name.toLowerCase().replace(/\s+/g, '-');
      setPropertyTemplates([...propertyTemplates, { ...propertyData, id: newPropertyId }]);
    }
  };

  const handleEditProperty = (property: PropertyTemplate) => {
    setEditingProperty(property);
    setIsPropertyModalOpen(true);
  };

  const handleDeleteProperty = (propertyId: string) => {
    setPropertyTemplates(propertyTemplates.filter(property => property.id !== propertyId));
  };

  const handleAddProperty = () => {
    setEditingProperty(null);
    setIsPropertyModalOpen(true);
  };

  // Функции для шаблонов предметов
  const handleEditItemTemplate = (template: ItemTemplate) => {
    console.log('Редактирование шаблона предмета:', template);
    // Реализация будет добавлена в ItemTemplatesSection
  };

  const handleDeleteItemTemplate = (templateId: string) => {
    setItemTemplates(itemTemplates.filter(template => template.id !== templateId));
  };

  const handleAddItemTemplate = () => {
    console.log('Добавление нового шаблона предмета');
    // Реализация будет добавлена в ItemTemplatesSection
  };

  // Функции для типов существ
  const handleEditCreatureType = (creature: CreatureType) => {
    console.log('Редактирование типа существа:', creature);
    // Реализация будет добавлена в CreatureTypesSection
  };

  const handleDeleteCreatureType = (creatureId: string) => {
    setCreatureTypes(creatureTypes.filter(creature => creature.id !== creatureId));
  };

  const handleAddCreatureType = () => {
    console.log('Добавление нового типа существа');
    // Реализация будет добавлена в CreatureTypesSection
  };

  const handleSaveRules = () => {
    // Логика сохранения правил
    console.log('Сохранение правил...');
    alert('Правила сохранены!');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Заголовок */}
      <RulesHeader
        onOpenSkillModal={() => setIsSkillModalOpen(true)}
        onOpenPropertyModal={() => setIsPropertyModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Основное содержимое */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Заголовок страницы */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">Редактор правил</h1>
              <p className="text-gray-400 mt-1">Настройте правила и механики игры</p>
            </div>
          </div>
          <Button 
            onClick={handleSaveRules}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Сохранить правила
          </Button>
        </div>

        {/* Вкладки */}
        <Tabs defaultValue="skills" className="space-y-6">
          <TabsList className="bg-gray-800 border-gray-700">
            <TabsTrigger value="skills" className="data-[state=active]:bg-gray-700">
              Навыки
            </TabsTrigger>
            <TabsTrigger value="properties" className="data-[state=active]:bg-gray-700">
              Свойства
            </TabsTrigger>
            <TabsTrigger value="items" className="data-[state=active]:bg-gray-700">
              Шаблоны предметов
            </TabsTrigger>
            <TabsTrigger value="creatures" className="data-[state=active]:bg-gray-700">
              Типы существ
            </TabsTrigger>
          </TabsList>

          {/* Вкладка навыков */}
          <TabsContent value="skills" className="space-y-6">
            <SkillGroups
              skillGroups={skillGroups}
              onEditSkill={handleEditSkill}
              onDeleteSkill={handleDeleteSkill}
              onAddSkill={handleAddSkill}
            />
          </TabsContent>

          {/* Вкладка свойств */}
          <TabsContent value="properties" className="space-y-6">
            <PropertyTemplates
              propertyTemplates={propertyTemplates}
              onEditProperty={handleEditProperty}
              onDeleteProperty={handleDeleteProperty}
              onAddProperty={handleAddProperty}
            />
          </TabsContent>

          {/* Вкладка шаблонов предметов */}
          <TabsContent value="items" className="space-y-6">
            <ItemTemplatesSection
              itemTemplates={itemTemplates}
              onEditTemplate={handleEditItemTemplate}
              onDeleteTemplate={handleDeleteItemTemplate}
              onAddTemplate={handleAddItemTemplate}
            />
          </TabsContent>

          {/* Вкладка типов существ */}
          <TabsContent value="creatures" className="space-y-6">
            <CreatureTypesSection
              creatureTypes={creatureTypes}
              skillGroups={skillGroups}
              onEditCreature={handleEditCreatureType}
              onDeleteCreature={handleDeleteCreatureType}
              onAddCreature={handleAddCreatureType}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Модальные окна */}
      <SkillModal
        isOpen={isSkillModalOpen}
        onClose={() => {
          setIsSkillModalOpen(false);
          setEditingSkill(null);
          setEditingSkillGroupId('');
        }}
        onSave={handleSaveSkill}
        skill={editingSkill}
        groupId={editingSkillGroupId}
        skillGroups={skillGroups}
      />

      <PropertyModal
        isOpen={isPropertyModalOpen}
        onClose={() => {
          setIsPropertyModalOpen(false);
          setEditingProperty(null);
        }}
        onSave={handleSaveProperty}
        property={editingProperty}
      />
    </div>
  );
}
