import { Counter, GameItem, Location, Note, NPC, PlayerCharacter } from "../types2";
import { AudioPlayerState, AudioQueueEntry, AudioTrack } from "./audio";
import { Player } from "./lobby";
import { LogMsg } from "./logmsg";
import { Observer, Scene, SessionSettings, SessionTimeline } from "./session";
import { SessionNotification } from "./session.notification";
import type { SessionDispatch } from "./sessionDispatch";
import type { SessionMessageReply } from "./sessionMessageReply";
import type { PlayerSeenEntry } from "./playerSeen";
import type { PresentedEntityView } from "./presentation";

export type WsRole = 'master' | 'player';
export type WsMsgType =
  | 'session_init'
  | 'session_update'
  | 'rpc_result'
  | 'session_finished'
  | 'session_not_found'
  | 'session_return_to_lobby'
  ;

export type SessionInitMessage = {
  msg_type: 'session_init';
  role: WsRole;

  // init-only for master
  story_beats?: any[];
  factories?: any[];

  // shared
  locations?: Location[];
  notes?: Note[];
  counters?: Counter[];
  items?: GameItem[];
  characters?: PlayerCharacter[];
  npcs?: NPC[];
  scenes?: Scene[];
  observers?: Observer[];
  notifications?: SessionNotification[];
  logs?: LogMsg[];
  players?: Player[];
  audio?: AudioTrack[];
  settings?: SessionSettings;

  polygon_shown?: string[];
  dispatches?: SessionDispatch[];
  message_replies?: SessionMessageReply[];
  player_seen?: PlayerSeenEntry[];
  data_revealed_entities?: PlayerSeenEntry[];
  presented_entity?: PresentedEntityView | null;

  audio_queue: AudioQueueEntry[];
  audio_player: AudioPlayerState;
  // meta
  session?: {
    id: string;
    scenario_id: string;
    name: string;
    created_at: string;
    master: any;
  };

  self_player?: Player | null;
  timeline?: SessionTimeline;
};

export type SessionUpdateMessage = {
  msg_type: 'session_update';
  role: WsRole;
  fields: string[];

  // sessionId injected in provider
  session_id: string;

  // partial fields
  locations?: Location[];
  characters?: PlayerCharacter[];
  scenes?: Scene[];
  observers?: Observer[];

  notes?: Note[];
  counters?: Counter[];
  items?: GameItem[];
  npcs?: NPC[];

  polygon_shown?: string[];
  dispatches?: SessionDispatch[];
  message_replies?: SessionMessageReply[];
  player_seen?: PlayerSeenEntry[];
  data_revealed_entities?: PlayerSeenEntry[];
  presented_entity?: PresentedEntityView | null;

  notifications?: SessionNotification[];
  logs?: LogMsg[];

  // if you ever send them (should be init-only for master)
  story_beats?: any[];
  factories?: any[];

  settings?: SessionSettings;

  audio_queue: AudioQueueEntry[];
  audio_player: AudioPlayerState;
  timeline?: SessionTimeline;
  // optional
  players?: Player[];
  self_player?: Player | null;
};


export type RpcResult = {
  msg_type: 'rpc_result';
  request_id: string;
  ok: boolean;
  error?: string | null;
  data?: any;
};

export type SessionFinishedMessage = {
  msg_type: 'session_finished';
  session_id: string;
  forced?: boolean;     // опционально, если с бэка шлёшь
};


export type SessionNotFoundMessage = {
  msg_type: 'session_not_found';
  session_id: string;
};

export type SessionReturnToLobbyMessage = {
  msg_type: 'session_return_to_lobby';
  session_id: string;
  lobby_id: string;
};


export type SessionWsMessage =
  | SessionInitMessage
  | SessionUpdateMessage
  | RpcResult
  | SessionFinishedMessage
  | SessionNotFoundMessage
  | SessionReturnToLobbyMessage
  ;
