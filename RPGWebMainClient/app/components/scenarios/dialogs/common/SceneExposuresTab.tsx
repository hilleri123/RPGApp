'use client';

import React from 'react';
import type { SceneExposureOut } from '@/app/services/types2';

import {
  SceneExposuresProvider,
  useSceneExposures,
  type IdName,
  type RightTab,
} from './scene_exposure/SceneExposuresContext';

import { ExposuresMasterList } from './scene_exposure/ExposuresMasterList';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NpcPickerPanel } from './scene_exposure/NpcPickerPanel';
import { ItemsPickerPanel } from './scene_exposure/ItemsPickerPanel';
import { ObstaclesPanel } from './scene_exposure/ObstaclesPanel';
import { ObstaclesPickerPanel } from './scene_exposure/ObstaclesPickerPanel';
import { TemplateItemsPickerPanel } from './scene_exposure/TemplateItemsPickerPanel';
import { TemplateNpcPickerPanel } from './scene_exposure/TemplateNpcPickerPanel';
import type { AudioTrack } from '@/app/services/types/audio';
import { AudioPickerPanel } from './scene_exposure/AudioPickerPanel';


export function SceneExposuresTab(props: {
  scenarioId: string;

  npcOptions?: IdName[] | null;
  itemOptions?: IdName[] | null;
  templateNpcOptions?: IdName[] | null;
  templateItemOptions?: IdName[] | null;
  audioOptions?: AudioTrack[] | null;   // ← добавить

  readOnly?: boolean;

  value: SceneExposureOut[];
  onChange: (next: SceneExposureOut[]) => void;

  config?: any;
}) {
  return (
    <SceneExposuresProvider readOnly={props.readOnly} value={props.value} onChange={props.onChange}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ExposuresMasterList />

        <div className="md:col-span-2 space-y-3">
          <RightTabs
            npcOptions={props.npcOptions}
            itemOptions={props.itemOptions}
            templateNpcOptions={props.templateNpcOptions}
            templateItemOptions={props.templateItemOptions}
            audioOptions={props.audioOptions}
            config={props.config}
          />
        </div>
      </div>
    </SceneExposuresProvider>
  );
}

function RightTabs(props: {
  npcOptions?: IdName[] | null;
  itemOptions?: IdName[] | null;
  templateNpcOptions?: IdName[] | null;
  templateItemOptions?: IdName[] | null;
  audioOptions?: AudioTrack[] | null;   // ← добавить
  config?: any;
}) {
  const { selected, rightTab, setRightTab } = useSceneExposures();

  return (
    <div className="min-h-[65vh] max-h-[65vh]">
      <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as RightTab)}>
        <TabsList>
          <TabsTrigger value="all">Все</TabsTrigger>
          <TabsTrigger value="npc">NPC</TabsTrigger>
          <TabsTrigger value="template_npcs">Шаблонные NPC</TabsTrigger>
          <TabsTrigger value="items">Предметы</TabsTrigger>
          <TabsTrigger value="template_items">Шаблонные предметы</TabsTrigger>
          <TabsTrigger value="obstacles">Препятствия</TabsTrigger>
          <TabsTrigger value="audio">Аудио</TabsTrigger> 
        </TabsList>

        <TabsContent value="all" className="space-y-3">
          <NpcPickerPanel />
          <ItemsPickerPanel />
          <ObstaclesPickerPanel />
          <TemplateNpcPickerPanel />
          <TemplateItemsPickerPanel />
          <AudioPickerPanel audioOptions={props.audioOptions} />
        </TabsContent>

        <TabsContent value="npc" className="space-y-3">
          <NpcPickerPanel npcOptions={props.npcOptions} />
        </TabsContent>

        <TabsContent value="items" className="space-y-3">
          <ItemsPickerPanel itemOptions={props.itemOptions} />
        </TabsContent>

        <TabsContent value="obstacles" className="space-y-3">
          <ObstaclesPanel config={props.config} />
        </TabsContent>

        <TabsContent value="template_npcs" className="space-y-3">
          <TemplateNpcPickerPanel npcOptions={props.templateNpcOptions} />
        </TabsContent>

        <TabsContent value="template_items" className="space-y-3">
          <TemplateItemsPickerPanel itemOptions={props.templateItemOptions} />
        </TabsContent>

        <TabsContent value="audio" className="space-y-3">   {/* ← добавить */}
          <AudioPickerPanel audioOptions={props.audioOptions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
