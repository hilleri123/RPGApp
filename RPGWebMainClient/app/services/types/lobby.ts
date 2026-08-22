import { User } from './auth'
import { Scenario, PlayerCharacter } from '../types2';

// Типы для сессий (из session.py)
export interface PlayerBase {
  name: string;
  session_id?: string;
  character_id?: string;
  application_id?: string;
  is_active?: boolean;
}

export interface PlayerCreate extends PlayerBase {
  // Наследует все поля PlayerBase
}

export interface Player extends PlayerCreate {
  id: string;
  joined_at: string; // ISO string
  user: User;
  is_ready: boolean;
  color?: string;
  character?: PlayerCharacter | null;
}


// Типы для лобби (из lobby.py)
export interface LobbyBase {
  name: string;
  created_at?: string; // ISO string
  max_players: number;
  players?: Player[];
  users?: User[];
  scenario?: Scenario;
  launched_scenario_id?: string | null;
  party_id?: string | null;
  campaign_id?: string | null;
  characters?: PlayerCharacter[];
}

/** Строка каталога лобби: без тела сценария, его отдаёт только WebSocket лобби. */
export interface LobbyPreview {
  id: string;
  name: string;
  created_at?: string;
  max_players: number;
  scenario_name?: string | null;
  master_id?: string | null;
  master_name: string;
  player_count: number;
  member_ids: string[];
}

export interface LobbyCreate extends LobbyBase {
  master_id?: string;
}

export interface Lobby extends LobbyBase {
  id: string;
  master: User;
}

// Типы действий (из lobby.py)
export interface ActionBase {
  user_id?: string;
  user_role: string;
  msg_type: string;
  created_at?: string; // ISO string
}

// Master actions
export interface MasterActionBase extends ActionBase {
  user_role: 'master';
}

export interface MasterSelectScenarioAction extends MasterActionBase {
  msg_type: 'select_scenario';
  scenario_id: string;
}

export interface MasterSelectLaunchedScenarioAction extends MasterActionBase {
  msg_type: 'select_launched_scenario';
  launched_scenario_id: string;
}

export interface MasterSelectPartyAction extends MasterActionBase {
  msg_type: 'select_party';
  party_id: string;
}

export interface MasterKickPlayer extends MasterActionBase {
  msg_type: 'kick_player';
  player_id: string;
}

export interface MasterDeselectPlayerCharacter extends MasterActionBase {
  msg_type: 'master_deselect_character';
  player_id: string;
  user_id?: string;
}

export interface MasterStartSession extends MasterActionBase {
  msg_type: 'start_session';
}

export interface MasterCloseLobby extends MasterActionBase {
  msg_type: 'close_lobby';
}

export interface MasterSelectCampaignAction extends MasterActionBase {
  msg_type: 'select_campaign';
  campaign_id: string;
}

export interface LobbyClosed {
  msg_type: 'lobby_closed';
}

export interface LobbyErrorMessage {
  msg_type: 'lobby_error';
  code: string;
  message: string;
}

// User actions
export interface UserActionBase extends ActionBase {
  user_role: 'user';
}

export interface UserBecomePlayerAction extends UserActionBase {
  msg_type: 'user_become_player';
  player: PlayerCreate;
}

export interface UserLeave extends UserActionBase {
  msg_type: 'user_leave';
}

// Player actions
export interface PlayerActionBase extends ActionBase {
  user_role: 'player';
}

export interface PlayerSelectCharacterAction extends PlayerActionBase {
  msg_type: 'select_character';
  character_id: string;
}

export interface PlayerSelectApplicationCharacterAction extends PlayerActionBase {
  msg_type: 'select_application_character';
  application_id: string;
}


export interface PlayerDeselectCharacterAction extends PlayerActionBase {
  msg_type: 'deselect_character';
}

export interface PlayerReady extends PlayerActionBase {
  msg_type: 'player_ready';
  is_ready: boolean;
}

export interface PlayerSelectColor extends PlayerActionBase {
  msg_type: 'select_color';
  color: string;
}

// Union type for all possible actions
export type LobbyAction = 
  | MasterSelectScenarioAction
  | MasterSelectLaunchedScenarioAction
  | MasterSelectPartyAction
  | MasterSelectCampaignAction
  | MasterKickPlayer
  | MasterDeselectPlayerCharacter
  | MasterStartSession
  | MasterCloseLobby
  | UserBecomePlayerAction
  | UserLeave
  | PlayerSelectCharacterAction
  | PlayerSelectApplicationCharacterAction
  | PlayerDeselectCharacterAction
  | PlayerReady
  | PlayerSelectColor
  ;

