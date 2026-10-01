'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, TimerIcon, ListTodo, Settings, BookOpen } from 'lucide-react';
import { ScenarioWikiTab } from '@/app/components/masterNotes/ScenarioWikiTab';
import { openMasterWikiCreate } from '@/app/components/masterNotes/openMasterWiki';
import { Button } from '@/components/ui/button';
import Header from '@/app/components/layout/Header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getNpcStyle, TYPE_ICONS } from '@/lib/constants';

import { useScenario } from '@/app/components/scenarios/ScenarioContext';
import ScenarioStoryBeatsList from './lists/StoryBeatsList';
import ScenarioLocationsList from './lists/LocationsList';
import ScenarioItemsList from './lists/GameItemsList';
import ScenarioCharactersList from './lists/CharactersList';
import ScenarioNpcsList from './lists/NPCsList';
import ScenarioNotesList from './lists/NotesList';
import ScenarioCountersList from './lists/CountersList';
import ScenarioFrontsList from './lists/FrontsList';
import { ScenarioTagsPanel } from './tabs/ScenarioTagsPanel';
import TemplateSetNpcsList from './lists/TemplateSetNpcsList';
import TemplateSetCharactersList from './lists/TemplateSetCharactersList';
import TemplateSetItemsList from './lists/TemplateSetItemsList';
import { TodoTab } from './tabs/TodoTab';
import { ScenarioSettingsTab } from './tabs/ScenarioSettingsTab';
import { ScenarioSearch } from './ScenarioSearch';
import { useUrlTab } from '@/app/services/hooks/useUrlTab';
import { Layers } from 'lucide-react';

const SCENARIO_TABS = [
  'story',
  'locations',
  'characters',
  'npcs',
  'items',
  'notes',
  'counters',
  'fronts',
  'todos',
  'settings',
  'wiki',
] as const;

type ScenarioTab = (typeof SCENARIO_TABS)[number];

export default function ScenarioPage() {
  const { loading, error, scenario, tabCounts, canEditEntities } = useScenario();
  const searchParams = useSearchParams();
  const fromSessionId = searchParams.get('fromSession');

  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTab, setActiveTab] = useUrlTab<ScenarioTab>(SCENARIO_TABS, 'story');

  const templatesToggle = useMemo(
    () => ({ checked: showTemplates, onCheckedChange: setShowTemplates }),
    [showTemplates, setShowTemplates],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-gray-300">Ошибка загрузки: {String(error)}</p>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-gray-300">Сценарий не найден.</p>
      </div>
    );
  }

  const { icon: NpcIcon } = getNpcStyle(false, false);
  const LocationIcon = TYPE_ICONS.location;
  const ItemIcon     = TYPE_ICONS.item;
  const CharacterIcon = TYPE_ICONS.character;
  const NoteIcon     = TYPE_ICONS.note;

  return (
    <div className="min-h-screen bg-gray-900">
      <Header section={`${canEditEntities ? 'Редактирование' : 'Просмотр'}: ${scenario.name}`} />
      <div className="max-w-7xl mx-auto p-6">
        {!canEditEntities && !scenario.is_session_snapshot ? (
          <div className="mb-4 rounded-md border border-blue-700/50 bg-blue-950/40 px-4 py-3 text-sm text-blue-100">
            Режим просмотра — у вас нет прав на редактирование сущностей этого сценария.
          </div>
        ) : null}
        {(scenario.is_session_snapshot || fromSessionId) ? (
          <div className="mb-4 rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100 space-y-2">
            <p>
              Запущенный сценарий — живёт между подходами. Изменения сохраняются в копию и подхватываются в активных сессиях.
            </p>
            {scenario.source_scenario_id ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/scenarios/${scenario.source_scenario_id}`}
                  className="underline hover:text-white"
                >
                  Исходный сценарий (prep)
                </Link>
                <span className="text-amber-200/60">·</span>
                <Link href="/launched-scenarios" className="underline hover:text-white">
                  Все запущенные
                </Link>
              </div>
            ) : null}
            {fromSessionId ? (
              <Link href={`/session/${fromSessionId}`} className="underline hover:text-white block">
                Вернуться в подход
              </Link>
            ) : null}
          </div>
        ) : null}
        <div className="mb-3 flex justify-end">
          <ScenarioSearch scenarioId={scenario.id} onNavigate={(tab) => setActiveTab(tab)} />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          {/* ── Список табов ── */}
          <TabsList>
            <TabsTrigger value="story">
              <LocationIcon className="w-4 h-4 mr-1" />
              Сюжет ({tabCounts.story})
            </TabsTrigger>

            <TabsTrigger value="locations">
              <LocationIcon className="w-4 h-4 mr-1" />
              Локации ({tabCounts.locations})
            </TabsTrigger>

            <TabsTrigger value="characters">
              <CharacterIcon className="w-4 h-4 mr-1" />
              Персонажи ({tabCounts.characters})
            </TabsTrigger>

            <TabsTrigger value="npcs">
              <NpcIcon className="w-4 h-4 mr-1" />
              NPC ({tabCounts.npcs})
            </TabsTrigger>

            <TabsTrigger value="items">
              <ItemIcon className="w-4 h-4 mr-1" />
              Предметы ({tabCounts.items})
            </TabsTrigger>

            <TabsTrigger value="notes">
              <NoteIcon className="w-4 h-4 mr-1" />
              Заметки ({tabCounts.notes})
            </TabsTrigger>

            <TabsTrigger value="counters">
              <TimerIcon className="w-4 h-4 mr-1" />
              Счётчики ({tabCounts.counters})
            </TabsTrigger>

            <TabsTrigger value="fronts">
              <Layers className="w-4 h-4 mr-1" />
              Фронты ({tabCounts.fronts ?? 0})
            </TabsTrigger>

            <TabsTrigger value="todos" className="relative">
              <ListTodo className="w-4 h-4 mr-1" />
              Todo
              {tabCounts.todos > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-medium px-1.5 min-w-[18px]">
                  {tabCounts.todos}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-1" />
              Настройки
            </TabsTrigger>

            <TabsTrigger value="wiki">
              <BookOpen className="w-4 h-4 mr-1" />
              Wiki
            </TabsTrigger>
          </TabsList>

          {/* ── Контент табов ── */}
          <TabsContent value="story">
            <ScenarioStoryBeatsList />
          </TabsContent>

          <TabsContent value="locations">
            <ScenarioLocationsList />
          </TabsContent>

          <TabsContent value="items">
            {showTemplates ? (
              <TemplateSetItemsList templatesToggle={templatesToggle} />
            ) : (
              <ScenarioItemsList templatesToggle={templatesToggle} />
            )}
          </TabsContent>

          <TabsContent value="characters">
            {showTemplates ? (
              <TemplateSetCharactersList templatesToggle={templatesToggle} />
            ) : (
              <ScenarioCharactersList templatesToggle={templatesToggle} />
            )}
          </TabsContent>

          <TabsContent value="npcs">
            {showTemplates ? (
              <TemplateSetNpcsList templatesToggle={templatesToggle} />
            ) : (
              <ScenarioNpcsList templatesToggle={templatesToggle} />
            )}
          </TabsContent>

          <TabsContent value="notes">
            <ScenarioNotesList />
          </TabsContent>

          <TabsContent value="counters">
            <ScenarioCountersList />
          </TabsContent>

          <TabsContent value="fronts">
            <ScenarioFrontsList />
          </TabsContent>

          <TabsContent value="todos">
            <TodoTab />
          </TabsContent>

          <TabsContent value="settings">
            <ScenarioSettingsTab />
          </TabsContent>

          <TabsContent value="wiki">
            <ScenarioWikiTab />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}