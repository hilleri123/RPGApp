import React from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Skill, SkillGroup } from '@/app/rules/types'

interface SkillGroupsProps {
  skillGroups: SkillGroup[];
  onEditSkill: (skill: Skill, groupId: string) => void;
  onDeleteSkill: (skillId: string, groupId: string) => void;
  onAddSkill: (groupId: string) => void;
}

export default function SkillGroups({ 
  skillGroups, 
  onEditSkill, 
  onDeleteSkill, 
  onAddSkill 
}: SkillGroupsProps) {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Группы навыков</h2>
        <p className="text-gray-400">Управляйте навыками персонажей по категориям</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skillGroups.map((group) => (
          <div key={group.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            {/* Заголовок группы */}
            <div className={`${group.color} p-4`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{group.name}</h3>
                <button
                  onClick={() => onAddSkill(group.id)}
                  className="p-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
                  title="Добавить навык"
                >
                  <Plus className="w-4 h-4 text-white" />
                </button>
              </div>
              <p className="text-white/80 text-sm mt-1">
                {group.skills.length} {group.skills.length === 1 ? 'навык' : 'навыков'}
              </p>
            </div>

            {/* Список навыков */}
            <div className="p-4 space-y-3">
              {group.skills.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Навыки не добавлены</p>
                  <button
                    onClick={() => onAddSkill(group.id)}
                    className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Добавить первый навык
                  </button>
                </div>
              ) : (
                group.skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="bg-gray-700 rounded-md p-3 border border-gray-600 hover:border-gray-500 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">
                          {skill.name}
                        </h4>
                        <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                          {skill.description}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => onEditSkill(skill, group.id)}
                          className="p-1 rounded text-gray-400 hover:text-blue-400 hover:bg-gray-600 transition-colors"
                          title="Редактировать навык"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDeleteSkill(skill.id, group.id)}
                          className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-gray-600 transition-colors"
                          title="Удалить навык"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Пустое состояние */}
      {skillGroups.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-medium text-gray-400 mb-2">Группы навыков не найдены</h3>
            <p className="text-gray-500">Создайте первую группу навыков для начала работы</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Экспорт типов для использования в других компонентах
export type { Skill, SkillGroup, SkillGroupsProps };
