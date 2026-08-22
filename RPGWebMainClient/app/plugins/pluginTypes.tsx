import { SessionAction } from "../services/types/session";

export type ActionHandlerProps = {
  user_id: string;
  action: SessionAction;                 // исходное действие (readonly)
  value: any;                            // draft, который редактирует UI
  onChange: (next: any) => void;         // обновление draft
  onPatch?: (patch: Record<string, unknown>) => void; // синхронизация черновика без смены stage
  onSubmit: (overrideValue?: any) => void;   // принудительный сабмит из стейджа
  setSubmitEnabled: (enabled: boolean) => void; // контроль кнопки Submit
  issues?: any[];
  /** Какую стадию показывать (из визарда ActionModal). По умолчанию — workflow.stageKey */
  stageKey?: string;
  /** Режим только просмотра (визард: frozen / pending / не editable) */
  readOnly?: boolean;
};

export type ActionLaunchProps = {
  action: {
    key: string;
    title: string;
    description?: string | null;
    roles?: string[] | null;
  };
  sceneId: string;
  onRun: (sceneId: string, actionKey: string) => void;
  compact?: boolean;
};

export type PluginUI = {
  CharacterDataView: React.ComponentType<any>;
  CharacterDataEditor: React.ComponentType<any>;
  NPCDataView: React.ComponentType<any>;
  NPCDataEditor: React.ComponentType<any>;
  ItemDataView: React.ComponentType<any>;
  ItemDataEditor: React.ComponentType<any>;
  LocationDataView: React.ComponentType<any>;
  LocationDataEditor: React.ComponentType<any>;
  ObstacleDataView: React.ComponentType<any>;
  ObstacleDataEditor: React.ComponentType<any>;
  SceneDataView: React.ComponentType<any>;
  SceneDataEditor: React.ComponentType<any>;
  ScenarioDataView: React.ComponentType<any>;
  ScenarioDataEditor: React.ComponentType<any>;

  ActionHandler: React.ComponentType<ActionHandlerProps>;
  /** Per-action-key launch button (falls back to DefaultActionLaunchButton). */
  ActionLaunchHandler: React.ComponentType<ActionLaunchProps>;
};
