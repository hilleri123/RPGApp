// store/sessions.ts
import { create } from 'zustand';

import type {
  GameSession,
  GameSessionBase,
  Scene,
  GameSessionPatch,
  SessionAction,
  Observer,
  SessionSettings,
  SessionTimeline,
} from '@/app/services/types/session';

import type {
  GameItem,
  NPC,
  PlayerCharacter,
  Location,
  Note,
  Counter,
  Factory,
  StoryBeatOut,
} from '../types2';

import type { LogMsg } from '../types/logmsg';
import type { Player } from '../types/lobby';
import type { SessionNotification } from '../types/session.notification';
import type { SessionDispatch } from '../types/sessionDispatch';
import type { SessionMessageReply } from '../types/sessionMessageReply';
import type { SessionInitMessage, SessionUpdateMessage, WsRole } from '../types/session.ws';
import type { PlayerSeenEntry } from '../types/playerSeen';
import type { PresentedEntityView } from '../types/presentation';
import type { AudioPlayerState, AudioQueueEntry, AudioTrack } from '../types/audio';
import { notifySessionWsUpdate } from '../session/sessionUpdateNotifications';

const DEFAULT_AUDIO_PLAYER: AudioPlayerState = {
  current_entry_id: null,
  playing: false,
  volume: 1.0,
  position_sec: 0.0,
  position_at: null,
};

type EnrichedSession = {
  fullSession: GameSession;
  session: GameSessionBase;

  storyBeats: StoryBeatOut[];
  factories: Factory[];
  polygon_shown: string[];

  locations: Location[];
  characters: PlayerCharacter[];
  npcs: NPC[];
  items: GameItem[];
  scenes: Scene[];
  observers: Observer[];

  notes: Note[];
  counters: Counter[];
  logs: LogMsg[];
  notifications: SessionNotification[];
  dispatches: SessionDispatch[];
  message_replies: SessionMessageReply[];
  actions: SessionAction[];
  settings: SessionSettings | null;

    audio_queue: AudioQueueEntry[];
    audio_player: AudioPlayerState;
    timeline: SessionTimeline | null;
    audio: AudioTrack[];

    selfPlayer: Player | null;
  isMaster: boolean;
  isPlayer: boolean;
  playerSeen: PlayerSeenEntry[];
  dataRevealedEntities: PlayerSeenEntry[];
  presentedEntity: PresentedEntityView | null;
};

type SessionsState = {
  sessions: Record<string, EnrichedSession>;
  sessionsPlayer: Record<string, EnrichedSession>;
  sessionsMaster: Record<string, EnrichedSession>;

  setWsInit: (msg: SessionInitMessage, userId: string) => void;
  patchWsUpdate: (msg: SessionUpdateMessage, userId: string) => void;

  setSessionData: (data: GameSession, userId?: string, roleHint?: WsRole) => void;
  patchSessionData: (patch: GameSessionPatch, userId?: string) => void;

  setConnected: (sessionId: string, connected: boolean) => void;
  removeSession: (sessionId: string) => void;
};

function buildGameSessionFromWsInit(msg: SessionInitMessage): GameSession {
  const base: any = {
    id:            msg.session?.id,
    scenario_id:   msg.session?.scenario_id,
    rule_id_str:   (msg.session as any)?.rule_id_str ?? (msg as any)?.rule_id_str,
    name:          msg.session?.name,
    created_at:    msg.session?.created_at,
    master:        msg.session?.master,

    players:       msg.players       ?? [],
    locations:     msg.locations     ?? [],
    characters:    msg.characters    ?? [],
    npcs:          msg.npcs          ?? [],
    items:         msg.items         ?? [],
    scenes:        msg.scenes        ?? [],
    observers:     msg.observers     ?? [],
    audio:         msg.audio         ?? [],
    notes:         msg.notes         ?? [],
    counters:      msg.counters      ?? [],
    notifications: msg.notifications ?? [],
    dispatches: (msg as any).dispatches ?? [],
    message_replies: (msg as any).message_replies ?? [],
    logs:          msg.logs          ?? [],
    settings:      msg.settings      ?? null,
    polygon_shown: msg.polygon_shown ?? [],
    actions:       (msg as any).actions ?? [],

    audio_queue:   (msg as any).audio_queue  ?? [],
    audio_player:  (msg as any).audio_player ?? { ...DEFAULT_AUDIO_PLAYER },
    timeline:      (msg as any).timeline ?? null,
    player_seen:   msg.player_seen ?? [],
    data_revealed_entities: (msg as any).data_revealed_entities ?? [],
    presented_entity: (msg as any).presented_entity ?? null,
    self_player:   (msg as any).self_player ?? null,
  };

  if ((msg as any).story_beats !== undefined) base.story_beats = (msg as any).story_beats ?? [];
  if ((msg as any).factories   !== undefined) base.factories   = (msg as any).factories   ?? [];

  return base as GameSession;
}

function mergeWsUpdate(base: GameSession, patch: SessionUpdateMessage): GameSession {
  const next: any = { ...base };

  const WS_EXTRA_FIELDS = ['player_seen', 'data_revealed_entities', 'self_player'] as const;

  if (Array.isArray(patch.fields)) {
    for (const field of patch.fields) {
      if ((patch as any)[field] !== undefined) {
        next[field] = (patch as any)[field];
      }
    }
    for (const field of WS_EXTRA_FIELDS) {
      if ((patch as any)[field] !== undefined) {
        next[field] = (patch as any)[field];
      }
    }
    if ((patch as any).audio_player != null) {
      next.audio_player = { ...(next.audio_player ?? DEFAULT_AUDIO_PLAYER), ...(patch as any).audio_player };
    }
  } else {
    Object.assign(next, patch);
  }

  // нормализация массивов
  if (next.notifications == null) next.notifications = [];
  if (next.dispatches == null) next.dispatches = [];
  if (next.message_replies == null) next.message_replies = [];
  if (next.actions       == null) next.actions       = [];
  if (next.locations     == null) next.locations     = [];
  if (next.polygon_shown == null) next.polygon_shown = [];
  if (next.characters    == null) next.characters    = [];
  if (next.npcs          == null) next.npcs          = [];
  if (next.items         == null) next.items         = [];
  if (next.scenes        == null) next.scenes        = [];
  if (next.observers     == null) next.observers     = [];
  if (next.notes         == null) next.notes         = [];
  if (next.counters      == null) next.counters      = [];
  if (next.logs          == null) next.logs          = [];
  if (next.players       == null) next.players       = [];
  if (next.audio_queue   == null) next.audio_queue   = [];

  // Keep scene.location in sync when locations are refreshed (REST/WS).
  if (Array.isArray(next.locations) && Array.isArray(next.scenes) && next.locations.length) {
    const byId = new Map(
      next.locations.map((loc: any) => [String(loc?.id ?? ''), loc] as const),
    );
    next.scenes = next.scenes.map((sc: any) => {
      const locId = String(sc?.location?.id ?? sc?.location_id ?? '');
      if (!locId) return sc;
      const fresh = byId.get(locId);
      if (!fresh) return sc;
      return { ...sc, location: { ...(sc.location ?? {}), ...fresh } };
    });
  }

  // нормализация audio_player
  if (next.audio_player == null) next.audio_player = { ...DEFAULT_AUDIO_PLAYER };

  if ('presented_entity' in patch && (patch as any).presented_entity === null) {
    next.presented_entity = null;
  }

  if ((patch as any).self_player !== undefined) {
    next.self_player = (patch as any).self_player;
  }

  return next as GameSession;
}

function computeRoleFlags(
  sessionData: GameSession,
  userId?: string,
  roleHint?: WsRole,
): { selfPlayer: Player | null; isMaster: boolean; isPlayer: boolean } {
  const fromPayload = (sessionData as any).self_player as Player | null | undefined;
  const selfPlayer: Player | null =
    fromPayload ??
    (userId
      ? ((sessionData.players ?? []).find((p: any) => p.user?.id === userId) ?? null)
      : null);

  const isMaster =
    roleHint === 'master' ? true
    : roleHint === 'player' ? false
    : !!(userId && sessionData.master?.id === userId);

  const isPlayer =
    roleHint === 'player' ? true
    : roleHint === 'master' ? false
    : !!selfPlayer;

  return { selfPlayer, isMaster, isPlayer };
}

function toEnrichedSession(
  sessionData: GameSession,
  userId?: string,
  roleHint?: WsRole,
): EnrichedSession {
  const { selfPlayer, isMaster, isPlayer } = computeRoleFlags(sessionData, userId, roleHint);

  return {
    // fullSession — база для следующего патча и наружу не отдаётся. Обновления
    // иммутабельные (mergeWsUpdate собирает новый объект), поэтому копия не
    // нужна: deep clone на каждый session_update перекладывал мегабайты сцены
    // и терял Date/undefined.
    fullSession: sessionData,
    session: {
      id:            sessionData.id,
      scenario_id:   sessionData.scenario_id,
      rule_id_str:   sessionData.rule_id_str,
      name:          sessionData.name,
      created_at:    sessionData.created_at,
      master:        sessionData.master,
      players:       sessionData.players       ?? [],
      logs:          sessionData.logs          ?? [],
      notifications: sessionData.notifications ?? [],
    } as any,

    storyBeats:    sessionData.story_beats  ?? [],
    factories:     sessionData.factories    ?? [],
    polygon_shown: sessionData.polygon_shown ?? [],

    locations:     sessionData.locations    ?? [],
    characters:    sessionData.characters   ?? [],
    npcs:          sessionData.npcs         ?? [],
    items:         sessionData.items        ?? [],
    scenes:        sessionData.scenes       ?? [],
    observers:     sessionData.observers    ?? [],
    notes:         sessionData.notes        ?? [],
    counters:      sessionData.counters     ?? [],
    notifications: sessionData.notifications ?? [],
    dispatches: (sessionData as any).dispatches ?? [],
    message_replies: (sessionData as any).message_replies ?? [],
    logs:          sessionData.logs         ?? [],
    settings:      sessionData.settings     ?? null,
    actions:       sessionData.actions      ?? [],

    audio_queue:   (sessionData as any).audio_queue  ?? [],
    audio_player:  (sessionData as any).audio_player ?? { ...DEFAULT_AUDIO_PLAYER },
    timeline:      (sessionData as any).timeline ?? null,
    audio:         (sessionData as any).audio ?? [],

    selfPlayer,
    isMaster,
    isPlayer,
    playerSeen: (sessionData as any).player_seen ?? [],
    dataRevealedEntities: (sessionData as any).data_revealed_entities ?? [],
    presentedEntity: (sessionData as any).presented_entity ?? null,
  };
}

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions:       {},
  sessionsPlayer: {},
  sessionsMaster: {},

  setWsInit: (msg, userId) => {
    const rawSession = buildGameSessionFromWsInit(msg);
    const sessionId  = rawSession.id;
    if (!sessionId) { console.warn('WS init without session id', msg); return; }

    (rawSession as any).actions       = (rawSession as any).actions       ?? [];
    (rawSession as any).notifications = (rawSession as any).notifications ?? [];

    const enriched = toEnrichedSession(rawSession, userId, msg.role);

    set((state) => {
      const next: Partial<SessionsState> = {
        sessions: { ...state.sessions, [sessionId]: enriched },
      };
      if (msg.role === 'master') {
        next.sessionsMaster = { ...state.sessionsMaster, [sessionId]: enriched };
      } else {
        next.sessionsPlayer = { ...state.sessionsPlayer, [sessionId]: enriched };
      }
      return next as SessionsState;
    });
  },

  patchWsUpdate: (patch, userId) => {
    const sessionId = patch.session_id;
    if (!sessionId) return;

    const state = useSessionsStore.getState();
    const base =
      state.sessionsMaster[sessionId]?.fullSession ??
      state.sessionsPlayer[sessionId]?.fullSession ??
      state.sessions[sessionId]?.fullSession;

    if (!base) { console.warn('No base session for patch', patch); return; }

    const newRawSession = mergeWsUpdate(base, patch);
    notifySessionWsUpdate(base, newRawSession, patch, userId);
    const enriched      = toEnrichedSession(newRawSession, userId, patch.role);

    set((state2) => {
      const next: Partial<SessionsState> = {
        sessions: { ...state2.sessions, [sessionId]: enriched },
      };
      if (patch.role === 'master') {
        next.sessionsMaster = { ...state2.sessionsMaster, [sessionId]: enriched };
      } else {
        next.sessionsPlayer = { ...state2.sessionsPlayer, [sessionId]: enriched };
      }
      return next as SessionsState;
    });
  },

  setSessionData: (sessionData, userId, roleHint) => {
    const sessionId = sessionData.id;
    if (!sessionId) return;

    sessionData.actions       = sessionData.actions       ?? [];
    sessionData.notifications = sessionData.notifications ?? [];

    const enriched = toEnrichedSession(sessionData, userId, roleHint);

    set((state) => {
      const next: Partial<SessionsState> = {
        sessions: { ...state.sessions, [sessionId]: enriched },
      };
      if (roleHint === 'master') {
        next.sessionsMaster = { ...state.sessionsMaster, [sessionId]: enriched };
      } else if (roleHint === 'player') {
        next.sessionsPlayer = { ...state.sessionsPlayer, [sessionId]: enriched };
      }
      return next as SessionsState;
    });
  },

  patchSessionData: (patch, userId) => {
    const sessionId =
      (patch as any).session_id ||
      Object.keys(useSessionsStore.getState().sessions)[0];
    if (!sessionId) return;

    const prev = useSessionsStore.getState().sessions[sessionId]?.fullSession;
    if (!prev) { console.warn('No base session for patch'); return; }

    const next: any = { ...prev };

    if ((patch as any).fields && Array.isArray((patch as any).fields)) {
      for (const field of (patch as any).fields) {
        if ((patch as any)[field] !== undefined) next[field] = (patch as any)[field];
      }
    } else {
      Object.assign(next, patch);
    }

    if (next.actions       == null) next.actions       = [];
    if (next.notifications == null) next.notifications = [];

    useSessionsStore.getState().setSessionData(next as GameSession, userId);
  },

  setConnected: (_sessionId, _connected) => {},

  removeSession: (sessionId) =>
    set((state) => {
      const sessions       = { ...state.sessions };
      const sessionsMaster = { ...state.sessionsMaster };
      const sessionsPlayer = { ...state.sessionsPlayer };
      delete sessions[sessionId];
      delete sessionsMaster[sessionId];
      delete sessionsPlayer[sessionId];
      return { sessions, sessionsMaster, sessionsPlayer };
    }),
}));