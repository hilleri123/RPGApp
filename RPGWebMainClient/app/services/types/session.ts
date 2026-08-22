import { User } from './auth'
import { Location, NPC, GameItem, ObstacleOutInline, Scenario, PlayerCharacter, Note, Counter, CounterCreate, NoteCreate, StoryBeatOut, Factory, LocationOut } from '../types2';
import { Player } from './lobby';
import { LogMoveItem, LogMsg } from './logmsg';
import { SessionNotification } from './session.notification';
import { AudioPlayerState, AudioQueueEntry, AudioTrack } from './audio';


export const MASTER_ROLE = 'master' as const;
export const PLAYER_ROLE = 'player' as const;



export type ActionIssueLevel = 'info' | 'warning' | 'error';

export interface ActionIssue {
  path: string;
  message: string;
  icon?: string;
  level: ActionIssueLevel;
}

export type WorkflowStatus = 'active' | 'completed' | 'canceled';

export interface SessionActionWorkflow {
  ok?: boolean; // можно оставить опционально для обратной совместимости
  status?: WorkflowStatus;

  // Новый контракт
  actionKey?: string;
  stageKey?: string;
  stageData?: Record<string, any>;
  context?: Record<string, any>;

  // Если где-то ещё остались старые действия
  step?: string;                 // legacy
  data?: Record<string, any>;    // legacy
}

export type SessionActionStatus = 'active' | 'completed' | 'failed' | 'canceled';

export interface SessionAction {
  id: string;
  can_close?: boolean;
  actionKey: string;
  participants: {
    initiatorUserId?: string;
  };
  scene?: any;
  workflow?: SessionActionWorkflow;
  participantIds: string[];
  status: SessionActionStatus;
  // Ошибки (если submit вернул ok=false и ты сохраняешь issues в action.workflow)
  issues?: ActionIssue[];
  sessionPatch?: Record<string, unknown> | null;
  // опционально если сервер добавит позже:
  scene_id?: string; // можно вычислять из workflow.data.scene_id
}


export interface SceneElements {
  obstacles: ObstacleOutInline[];
  npcs: NPC[];
  items: GameItem[];
}

export interface SceneAvailableAction {
  key: string;
  title: string;
  roles: Array<'gm' | 'initiator' | 'player'>;
  description?: string;
}

export interface Scene {
  id: string;
  name: string;
  location?: Location | null;
  characters: PlayerCharacter[];
  public: SceneElements;
  private: SceneElements;

  datetime: string | null;

  parent_scene_id?: string;

  data: Record<string, any>;

  available_actions?: SceneAvailableAction[]; // <- новое
}

export interface Observer {
  code: string;
  scene_id?: string;
  location_id?: string;
}

export interface SessionSettings {
  show_action_to_everyone: boolean;
  merge_scenes_for_players: boolean;
  hide_audio_name: boolean;
  audio_mode: "local" | "observer";
  edit_scenario: boolean;
  allow_character_swap?: boolean;
  master_filter_tags?: string[];
}

export interface SessionTimeline {
  scenario_started_at?: string | null;
  current_time?: string | null;
  events?: Array<Record<string, unknown>>;
}


// Базовые данные сессии
export interface GameSessionBase {
  scenario_id: string;
  rule_id_str: string;
  name: string;
  created_at?: string; // ISO string
  master: User;
  players: Player[];
  campaign_id?: string | null;
  campaign_step_index?: number | null;
  campaign_name?: string | null;
  campaign_total_steps?: number | null;
  launched_scenario_id?: string | null;
  party_id?: string | null;
}

export interface ScenarioSessionBase {
  user: User,
  locations: Location[];
  characters: PlayerCharacter[];
  story_beats: StoryBeatOut[];
  npcs: NPC[];
  items: GameItem[];
  notes: Note[];
  counters: Counter[];
  settings: SessionSettings | null;
}

// Полная модель сессии с дополнительными данными сценария
export interface GameSession extends GameSessionBase, ScenarioSessionBase {
  id: string;
  logs: LogMsg[];
  notifications: SessionNotification[];
  scenes: Scene[];
  observers: Observer[];

  polygon_shown: string[];

  factories: Factory[];
  audio: AudioTrack[];

  audio_queue: AudioQueueEntry[];
  audio_player: AudioPlayerState;

  actions: SessionAction[]; // <- новое
}

// Превью сессии (облегченный вариант)
export interface GameSessionPreview extends GameSessionBase {
  id: string;
  scenario: Scenario;
}


// Список известных полей GameSession; добавь остальные при необходимости
type GameSessionPatchKeys =
  | 'locations'
  | 'characters'
  | 'npcs'
  | 'items'
  | 'scenes'
  | 'logs'
  | 'formula_evals'
  | 'rule'
  | 'players'
  | 'master'
  | 'name'
  | 'notifications'
  | 'actions' // <- новое
  ;

// Тип для PATCH-объекта WebSocket/REST обновления сессии
export interface GameSessionPatch {
  session_id?: string;
  fields: GameSessionPatchKeys[];
  locations?: Location[];
  characters?: PlayerCharacter[];
  notifications?: SessionNotification[];
  actions?: SessionAction[]; // <- новое
  npcs?: NPC[];
  items?: GameItem[];
  scenes?: Scene[];
  logs?: LogMsg[];
  players?: Player[];
  master?: User;
  name?: string;
}

export interface SessionActionRPC {
  user_id?: string;
  user_role: string;
  msg_type: string;
  entity?: string;
  scene_id?: string | null;
  created_at?: string; // ISO string
  context?: any;
}


// Типы действий сессии (пример)
export interface SessionActionBase {
  user_id?: string;
  user_role: string;
  msg_type: string;
  created_at?: string; // ISO string
}

// Пример действий мастера в сессии
export interface MasterSessionActionBase extends SessionActionBase {
  user_role: typeof MASTER_ROLE;
}

export interface PlayerSessionActionBase extends SessionActionBase {
  user_role: typeof PLAYER_ROLE;
}

export interface ParticipantSessionActionBase extends SessionActionBase {
  user_role: typeof MASTER_ROLE | typeof PLAYER_ROLE;
}

export interface MasterSetLocationCheck extends MasterSessionActionBase {
  msg_type: 'set_location_check';
  location_id: string;
  polygon_id: string;
  is_visible: boolean;
}

export interface MasterMoveCharacterToLocation extends MasterSessionActionBase {
  msg_type: 'move_character_to_location';
  character_id: string;
  location_id: string;
}


export interface MasterMakeNPCDead extends MasterSessionActionBase {
  msg_type: 'make_npc_dead';
  npc_id: string;
  is_dead: boolean;
}

export interface MasterMoveToScene extends MasterSessionActionBase {
  msg_type: 'move_to_scene';
  scene_id: string;
  npc_id?: string;
  item_id?: string;
}

export interface MasterMoveOutScene extends MasterSessionActionBase {
  msg_type: 'move_out_scene';
  scene_id: string;
  npc_id?: string;
  item_id?: string;
  obstacle_id?: string;
}

export interface MasterAddScene extends MasterSessionActionBase {
  msg_type: 'add_scene';
  location_id: string;
}

export interface MasterUpdateSceneData extends MasterSessionActionBase {
  msg_type: 'update_scene_data';
  scene_id: string;
  data: any;
}

export interface MasterDelScene extends MasterSessionActionBase {
  msg_type: 'del_scene';
  scene_id: string;
}

export interface MasterMergeScene extends MasterSessionActionBase {
  msg_type: 'merge_scene';
  scene_id: string;
  to_scene_id: string;
}

export interface MasterSetMainScene extends MasterSessionActionBase {
  msg_type: 'set_main_scene';
  scene_id: string;
}

export interface MasterExpandScene extends MasterSessionActionBase {
  msg_type: 'scene_expand';
  scene_id: string;
}

export interface MasterCollapseScene extends MasterSessionActionBase {
  msg_type: 'scene_collapse';
  scene_id: string;
}

export interface MasterSetSceneLocation extends MasterSessionActionBase {
  msg_type: 'set_scene_location';
  scene_id: string;
  location_id: string;
}

export interface MasterMoveCharacterToScene extends MasterSessionActionBase {
  msg_type: 'move_character_to_scene';
  scene_id: string;
  character_id: string;
}

export interface MasterSetSceneTime extends MasterSessionActionBase {
  msg_type: 'set_scene_time';
  scene_id: string;
  time: string; // TODO: уточните формат времени при необходимости
}

export interface MasterSetSessionTime extends MasterSessionActionBase {
  msg_type: 'set_session_time';
  time: string;
}

export interface MasterMakeElementPublic extends MasterSessionActionBase {
  msg_type: 'make_element_public';
  scene_id: string;
  npc_id?: string;
  item_id?: string;
  obstacle_id?: string;
  public: boolean;
}

export interface MasterCreateLocation extends MasterSessionActionBase {
  msg_type: 'create_location';
  location: any;
}

export interface MasterUpdateLocation extends MasterSessionActionBase {
  msg_type: 'update_location';
  location: any;
}


export interface MasterUpdateCharacter extends MasterSessionActionBase {
  msg_type: 'update_character';
  character: PlayerCharacter;
}

export interface MasterCreateItem extends MasterSessionActionBase {
  msg_type: 'create_item';
  scene_id: string;
  item: any;
}

export interface MasterCreateNPC extends MasterSessionActionBase {
  msg_type: 'create_npc';
  scene_id: string;
  npc: any;
}

export interface MasterUpdateItem extends MasterSessionActionBase {
  msg_type: 'update_item';
  scene_id: string;
  item: any;
}

export interface MasterUpdateNPC extends MasterSessionActionBase {
  msg_type: 'update_npc';
  scene_id: string;
  npc: any;
}

export interface MasterDeleteItem extends MasterSessionActionBase {
  msg_type: 'delete_item';
  item_id: string;
}

export interface MasterDeleteNPC extends MasterSessionActionBase {
  msg_type: 'delete_npc';
  npc_id: string;
}

export interface CreateObstacle extends MasterSessionActionBase {
  msg_type: "create_obstacle";
  scene_id: string;
  obstacle: any; // позже типизируешь
};

export interface UpdateObstacle extends MasterSessionActionBase {
  msg_type: "update_obstacle";
  scene_id: string;
  obstacle: any; // позже типизируешь
};



export interface MoveItem extends ParticipantSessionActionBase {
  msg_type: 'move_item';
  item_id: string;
  to_character_id?: string
  to_npc_id?: string
  to_location_id?: string
}



export interface DropItem extends PlayerSessionActionBase {
  msg_type: 'drop_item';
  item_id: string;
}

export interface TakeItem extends PlayerSessionActionBase {
  msg_type: 'take_item';
  item_id: string;
}

export interface PlayerReplaceCharacter extends PlayerSessionActionBase {
  msg_type: 'player_replace_character';
  character_id: string;
  application_id?: string | null;
}

export interface ReplaceCharacterOption {
  id: string;
  name: string;
  short_desc?: string | null;
  source: 'scenario' | 'application';
  application_id?: string | null;
}

export interface NoteCreateAction extends MasterSessionActionBase {
  msg_type: 'note_create';
  note: NoteCreate;
}

export interface NoteDeleteAction extends MasterSessionActionBase {
  msg_type: 'note_delete';
  note_id: string;
}

export interface NoteShownAction extends MasterSessionActionBase {
  msg_type: 'note_shown';
  note_id: string;
  characters_ids: string[];
}

export interface RevokeDispatch extends MasterSessionActionBase {
  msg_type: 'revoke_dispatch';
  dispatch_id: string;
}

export interface EditOwnedNote extends ParticipantSessionActionBase {
  msg_type: 'edit_note';
  note_id: string;
  note: NoteCreate;
}

export interface AddMessageReply extends ParticipantSessionActionBase {
  msg_type: 'add_message_reply';
  note_id: string;
  text: string;
}

export interface EditMessageReply extends ParticipantSessionActionBase {
  msg_type: 'edit_message_reply';
  reply_id: string;
  text: string;
}

export interface DeleteMessageReply extends ParticipantSessionActionBase {
  msg_type: 'delete_message_reply';
  reply_id: string;
}

export interface PlayerCreateNote extends PlayerSessionActionBase {
  msg_type: 'note_create';
  note: NoteCreate;
}

export interface PlayerPublishNote extends PlayerSessionActionBase {
  msg_type: 'note_shown';
  note_id: string;
  characters_ids: string[];
  include_master?: boolean;
}

export interface EditDispatch extends ParticipantSessionActionBase {
  msg_type: 'edit_dispatch';
  dispatch_id: string;
  note: NoteCreate;
}

export interface MarkDispatchOpened extends ParticipantSessionActionBase {
  msg_type: 'mark_dispatch_opened';
  dispatch_id: string;
}

export interface CounterCreateAction extends MasterSessionActionBase {
  msg_type: 'counter_create';
  counter: CounterCreate;
}

export interface CounterDeleteAction extends MasterSessionActionBase {
  msg_type: 'counter_delete';
  counter_id: string;
}

export interface CounterValueChangeAction extends MasterSessionActionBase {
  msg_type: 'counter_value_change';
  counter_id: string;
  value: number;
}

export interface ReadNotifications extends ParticipantSessionActionBase {
  msg_type: 'read_notifications';
  notifications_ids: string[];
}


export interface RunSceneAction extends ParticipantSessionActionBase {
  msg_type: 'run_scene_action';
  scene_id: string;
  action_key: string;
  // опционально: payload под плагины/систему
  params?: Record<string, any>;
}

export interface CancelSceneAction extends ParticipantSessionActionBase {
  msg_type: 'cancel_action_step';
  action_id: string;
}


export interface SubmitActionStep extends ParticipantSessionActionBase {
  msg_type: 'submit_action_step';
  action_id: string;
  input: Record<string, any>;
}

export interface PatchActionStep extends ParticipantSessionActionBase {
  msg_type: 'patch_action_step';
  action_id: string;
  input: Record<string, any>;
}


export interface ChangeNoteStatus extends ParticipantSessionActionBase {
  msg_type: 'change_note_status';
  note_id: string;
  status: null | "pending" | "completed";
}

export interface CreateFactoryObject extends ParticipantSessionActionBase {
  msg_type: 'create_factory_object';
  scene_id: string | null;
  kind: 'npc' | 'item' | 'character';
  object_id: string;
}

export interface ApplySceneExposure extends ParticipantSessionActionBase {
  msg_type: 'apply_exposition';
  scene_id: string;
  from_location_id?: string;
  from_story_beat?: string;
  exposition_id: string;
}

export interface MasterToggleLocationHidden extends MasterSessionActionBase {
  msg_type: 'toggle_location_hidden';
  location_id: string;
  hidden: boolean;
};



export interface CreateObserver extends MasterSessionActionBase {
  msg_type: 'create_observer';
}

export interface UpdateObserver extends MasterSessionActionBase {
  msg_type: 'update_observer';
  observer: Observer;
}

export interface DeleteObserver extends MasterSessionActionBase {
  msg_type: 'delete_observer';
  code: string;
}


export interface MasterSetSettings extends MasterSessionActionBase {
  msg_type: 'set_settings';
  settings: SessionSettings;
}

export interface MasterSetDefaultSettings extends MasterSessionActionBase {
  msg_type: 'set_default_settings';
}

export interface MasterKickPlayer extends MasterSessionActionBase {
  msg_type: 'kick_player';
  player_id: string;
}

export interface MasterDeselectPlayerCharacter extends MasterSessionActionBase {
  msg_type: 'master_deselect_character';
  player_id: string;
}

export interface MasterAssignPlayerCharacter extends MasterSessionActionBase {
  msg_type: 'master_assign_character';
  player_id: string;
  character_id: string;
}

export interface MasterSetPlayerColor extends MasterSessionActionBase {
  msg_type: 'master_set_player_color';
  player_id: string;
  color: string;
}

export interface AudioCommand extends MasterSessionActionBase {
  msg_type: 'audio_command';
  command: 'play' | 'pause' | 'stop' | 'clear_queue';
}


export interface AudioCommandPlayEntry extends MasterSessionActionBase {
  msg_type: 'audio_command_play_entry';
  entry_id: string;
}

export interface AudioCommandSetVolume extends MasterSessionActionBase {
  msg_type: 'audio_command_set_volume';
  volume: number;
}

export interface AudioCommandSyncPosition extends MasterSessionActionBase {
  msg_type: 'audio_command_sync_position';
  position_sec: number;
}

export interface AudioCommandEnqueueTrack extends MasterSessionActionBase {
  msg_type: 'audio_command_enqueue_track';
  audio_track_id: string;
  play?: boolean;
}

export interface PresentEntity extends MasterSessionActionBase {
  msg_type: 'present_entity';
  scene_id: string;
  entity_type: 'npc' | 'game_item' | 'player_character' | 'location';
  entity_id: string;
  data_access?: 'none' | 'full';
}

export interface GrantEntityDataAccess extends MasterSessionActionBase {
  msg_type: 'grant_entity_data_access';
  scene_id: string;
  entity_type: 'npc' | 'game_item' | 'player_character';
  entity_id: string;
}

export interface RevokeEntityDataAccess extends MasterSessionActionBase {
  msg_type: 'revoke_entity_data_access';
  scene_id: string;
  entity_type: 'npc' | 'game_item' | 'player_character';
  entity_id: string;
}

export interface DismissPresentedEntity extends MasterSessionActionBase {
  msg_type: 'dismiss_presented_entity';
}

// Объединенный тип действий сессии
export type MasterSessionAction =
  | MasterMakeNPCDead
  | MasterMoveToScene
  | MasterMoveOutScene
  | MasterAddScene
  | MasterUpdateSceneData
  | MasterDelScene
  | MasterMergeScene
  | MasterSetMainScene
  | MasterSetSceneLocation
  | MasterMoveCharacterToScene
  | MasterSetSceneTime
  | MasterSetSessionTime
  | MasterMakeElementPublic
  | MasterCreateItem
  | LogMoveItem
  | DropItem
  | TakeItem
  | NoteCreateAction
  | NoteDeleteAction
  | NoteShownAction
  | RevokeDispatch
  | MarkDispatchOpened
  | CounterCreateAction
  | CounterDeleteAction
  | CounterValueChangeAction
  | ReadNotifications
  | CreateObstacle
  | RunSceneAction
  | SubmitActionStep
  | PatchActionStep
  | MasterToggleLocationHidden
  | CreateObserver
  | UpdateObserver
  | DeleteObserver
  | MasterSetSettings
  | MasterSetDefaultSettings
  | CreateFactoryObject
  | AudioCommand
  | AudioCommandPlayEntry
  | AudioCommandSetVolume
  | AudioCommandSyncPosition
  | AudioCommandEnqueueTrack
  | PresentEntity
  | GrantEntityDataAccess
  | RevokeEntityDataAccess
  | DismissPresentedEntity
  // | ... (можно добавить новые действия по аналогии)
  ;