import React from 'react';
import { Plus, Search, Settings, Home } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RulesHeaderProps {
  onOpenSkillModal: () => void;
  onOpenPropertyModal: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function RulesHeader({ 
  onOpenSkillModal, 
  onOpenPropertyModal,
  searchQuery = '',
  onSearchChange 
}: RulesHeaderProps) {
  return (
    <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Левая часть - логотип и навигация */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
              <h1 className="text-xl font-bold text-white">Правила игры</h1>
            </div>

            {/* Навигационные ссылки */}
            <div className="hidden md:flex items-center gap-4">
              <button className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors">
                <Home className="w-4 h-4" />
                <span className="text-sm">Главная</span>
              </button>
              <button className="flex items-center gap-2 px-3 py-2 text-white bg-gray-700 rounded-md">
                <span className="text-sm">Правила</span>
              </button>
            </div>
          </div>

          {/* Центральная часть - поиск */}
          {onSearchChange && (
            <div className="hidden lg:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Поиск навыков и свойств..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Правая часть - действия */}
          <div className="flex items-center gap-3">
            {/* Кнопки добавления */}
            <div className="flex items-center gap-2">
              <Button
                onClick={onOpenSkillModal}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Навык</span>
              </Button>
              
              <Button
                onClick={onOpenPropertyModal}
                size="sm"
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Свойство</span>
              </Button>
            </div>

            {/* Кнопка настроек */}
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Мобильный поиск */}
        {onSearchChange && (
          <div className="lg:hidden pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Поиск..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export type { RulesHeaderProps };
