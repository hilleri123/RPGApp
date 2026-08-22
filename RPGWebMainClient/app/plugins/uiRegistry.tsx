'use client';

import dynamic from 'next/dynamic';
import { PluginActionHandlerStub, PluginDataEditorStub, PluginDataViewer } from './mock';
import React from 'react';
import { UI_LOADERS } from './loaders';
import { PluginUI } from './pluginTypes';
import DefaultActionLaunchButton from '@/app/components/session/common/actions/DefaultActionLaunchButton';



export function asComponent(x: any) {
  // поддержка require(...) где компонент лежит в default
  return x?.default ?? x;
}


function dynFromPlugin<P>(
  pluginId: string,
  exportName: string,
  fallback: React.ComponentType<P>
): React.ComponentType<P> {
  const loader = UI_LOADERS[pluginId];

  return dynamic(async () => {
    if (!loader) return fallback as any;

    try {
      const m = await loader();
      const Comp = asComponent(m?.[exportName]) as React.ComponentType<P> | undefined;
      return (Comp ?? fallback) as any;
    } catch {
      return fallback as any;
    }
  }, { ssr: false }) as any;
}


export function getPluginUI(pluginId: string): PluginUI | null {
  const Viewer = PluginDataViewer;
  const Editor = PluginDataEditorStub;

  return {
    CharacterDataView: dynFromPlugin(pluginId, 'CharacterDataView', Viewer),
    CharacterDataEditor: dynFromPlugin(pluginId, 'CharacterDataEditor', Editor),

    NPCDataView: dynFromPlugin(pluginId, 'NPCDataView', Viewer),
    NPCDataEditor: dynFromPlugin(pluginId, 'NPCDataEditor', Editor),

    ItemDataView: dynFromPlugin(pluginId, 'ItemDataView', Viewer),
    ItemDataEditor: dynFromPlugin(pluginId, 'ItemDataEditor', Editor),

    LocationDataView: dynFromPlugin(pluginId, 'LocationDataView', Viewer),
    LocationDataEditor: dynFromPlugin(pluginId, 'LocationDataEditor', Editor),

    ObstacleDataView: dynFromPlugin(pluginId, 'ObstacleDataView', Viewer),
    ObstacleDataEditor: dynFromPlugin(pluginId, 'ObstacleDataEditor', Editor),

    SceneDataView: dynFromPlugin(pluginId, 'SceneDataView', Viewer),
    SceneDataEditor: dynFromPlugin(pluginId, 'SceneDataEditor', Editor),

    ScenarioDataView: dynFromPlugin(pluginId, 'ScenarioDataView', Viewer),
    ScenarioDataEditor: dynFromPlugin(pluginId, 'ScenarioDataEditor', Editor),

    ActionHandler: dynFromPlugin(pluginId, 'ActionHandler', PluginActionHandlerStub),
    ActionLaunchHandler: dynFromPlugin(pluginId, 'ActionLaunchHandler', DefaultActionLaunchButton),
  };
}
