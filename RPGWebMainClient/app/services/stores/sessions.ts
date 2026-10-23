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
  applyObjectBatch: (
    sessionId: string,
    changes: { object_type: string; object_id: string; op: string }[],
    bodies: { object_type: string; object_id: string; body: any }[],
    userId?: string,
  ) => void;

  setSessionData: (data: GameSession, userId?: string, roleHint?: WsRole) => void;
  patchSessionData: (patch: GameSessionPatch, userId?: string) => void;

  setConnected: (sessionId: string, connected: boolean) => void;
  removeSession: (sessionId: string) => void;
  patchCharacterPhotos: (
    sessionId: string,
    characterId: string,
    photos: { icon_url: string | null; img_url: string | null },
  ) => void;
};

function characterMatchesPhoto(entity: any, characterId: string): boolean {
  if (!entity || typeof entity !== 'object') return false;
  return [entity.id, entity.copied_from, entity.source_entity_id, entity.application_id]
    .some((value) => value && String(value) === characterId);
}

function paintCharacter(
  entity: any,
  characterId: string,
  photos: { icon_url: string | null; img_url: string | null },
) {
  if (!characterMatchesPhoto(entity, characterId)) return entity;
  return { ...entity, icon_url: photos.icon_url, img_url: photos.img_url };
}

function paintSessionPhotos(
  session: GameSession,
  characterId: string,
  photos: { icon_url: string | null; img_url: string | null },
): GameSession {
  const next: any = { ...session };
  next.characters = (session.characters || []).map((ch) => paintCharacter(ch, characterId, photos));
  next.players = (session.players || []).map((player: any) => ({
    ...player,
    character: paintCharacter(player.character, characterId, photos),
  }));
  if ((session as any).self_player) {
    const self = (session as any).self_player;
    next.self_player = {
      ...self,
      character: paintCharacter(self.character, characterId, photos),
    };
  }
  next.scenes = (session.scenes || []).map((scene: any) => ({
    ...scene,
    characters: (scene.characters || []).map((ch: any) => paintCharacter(ch, characterId, photos)),
  }));
  return next;
}

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

const OBJECT_FIELDS: Record<string, string> = {
  player_character: 'characters',
  npc: 'npcs',
  game_item: 'items',
  location: 'locations',
  obstacle: 'obstacles',
  note: 'notes',
  story_beat: 'story_beats',
  scene: 'scenes',
  action: 'actions',
  log: 'logs',
  audio_queue: 'audio_queue',
  inventory: 'inventories',
  gesture: 'gestures',
};

const OBJECT_ORDER = [
  'player_character', 'npc', 'game_item', 'location', 'obstacle', 'note', 'story_beat',
  'inventory', 'log', 'audio_queue', 'gesture', 'scene', 'action',
];

function upsertById(list: any[], body: any): any[] {
  const id = String(body?.id ?? '');
  if (!id) return list;
  const index = list.findIndex((item) => String(item?.id) === id);
  if (index < 0) return [...list, body];
  return list.map((item, i) => (i === index ? { ...item, ...body } : item));
}

function idsFrom(side: any, idKey: string, embeddedKey: string): string[] | null {
  if (Array.isArray(side?.[idKey])) return side[idKey].map((id: unknown) => String(id));
  if (Array.isArray(side?.[embeddedKey])) {
    return side[embeddedKey].map((item: any) => String(item?.id ?? '')).filter(Boolean);
  }
  return null;
}

function pickByIds(list: any[] | undefined, ids: string[] | null, previous: any[] | undefined): any[] {
  if (!ids) return previous ?? [];
  return ids
    .map((id) => (list ?? []).find((item) => String(item?.id) === id)
      || (previous ?? []).find((item) => String(item?.id) === id))
    .filter(Boolean);
}

function hydrateScene(scene: any, session: any, role?: WsRole): any {
  const previousPublic = scene.public ?? {};
  const previousPrivate = scene.private ?? {};
  const fillSide = (side: any, previous: any) => {
    const npcIds = idsFrom(side, 'npc_ids', 'npcs');
    const itemIds = idsFrom(side, 'item_ids', 'items');
    const obstacleIds = idsFrom(side, 'obstacle_ids', 'obstacles');
    return {
      ...previous,
      ...side,
      npcs: pickByIds(session.npcs, npcIds, previous?.npcs),
      items: pickByIds(session.items, itemIds, previous?.items),
      obstacles: pickByIds(
        [...(session.obstacles ?? []), ...(side?.obstacles ?? [])],
        obstacleIds,
        previous?.obstacles,
      ),
    };
  };
  const characterIds = Array.isArray(scene.character_ids)
    ? scene.character_ids.map((id: unknown) => String(id))
    : (scene.characters ?? []).map((ch: any) => String(ch?.id ?? '')).filter(Boolean);
  const locationId = String(scene.location_id ?? scene.location?.id ?? '');
  const location = locationId
    ? (session.locations ?? []).find((loc: any) => String(loc?.id) === locationId) ?? scene.location
    : scene.location;
  const roleKey = role === 'master' ? 'gm' : 'player';
  const byRole = scene.available_actions_by_role;
  const available = byRole?.[roleKey] ?? scene.available_actions ?? [];
  let parentLocation = scene.parent_scene_location ?? null;
  if (scene.show_parent_scene_map && scene.parent_scene_id) {
    const parent = (session.scenes ?? []).find((item: any) => String(item?.id) === String(scene.parent_scene_id));
    const parentLocationId = String(parent?.location_id ?? parent?.location?.id ?? '');
    if (parentLocationId) {
      parentLocation = (session.locations ?? []).find((loc: any) => String(loc?.id) === parentLocationId) ?? parentLocation;
    }
  }
  return {
    ...scene,
    location,
    parent_scene_location: parentLocation,
    available_actions: available,
    characters: pickByIds(session.characters, characterIds, scene.characters),
    public: fillSide(scene.public, previousPublic),
    private: fillSide(scene.private, previousPrivate),
  };
}

function hydrateAction(action: any, session: any): any {
  if (action?.scene) return action;
  const scene = (session.scenes ?? []).find((item: any) => String(item?.id) === String(action?.scene_id));
  return scene ? { ...action, scene } : action;
}

function hydrateSessionObjects(session: any, role?: WsRole): any {
  const scenes = (session.scenes ?? []).map((scene: any) => hydrateScene(scene, session, role));
  const withScenes = { ...session, scenes };
  return {
    ...withScenes,
    actions: (withScenes.actions ?? []).map((action: any) => hydrateAction(action, withScenes)),
  };
}

function applyBodies(
  session: any,
  changes: { object_type: string; object_id: string; op: string }[],
  bodies: { object_type: string; object_id: string; body: any }[],
  role?: WsRole,
): any {
  const next: any = { ...session };
  const bodyByKey = new Map(bodies.map((row) => [`${row.object_type}:${row.object_id}`, row.body]));
  const ordered = [...changes].sort(
    (a, b) => OBJECT_ORDER.indexOf(a.object_type) - OBJECT_ORDER.indexOf(b.object_type),
  );
  for (const change of ordered) {
    const field = OBJECT_FIELDS[change.object_type];
    if (!field) continue;
    const list = Array.isArray(next[field]) ? next[field] : [];
    if (change.op === 'gone') {
      next[field] = list.filter((item: any) => String(item?.id) !== String(change.object_id));
      continue;
    }
    const body = bodyByKey.get(`${change.object_type}:${change.object_id}`);
    if (!body) continue;
    next[field] = upsertById(list, body);
    if (change.object_type === 'player_character') {
      next.players = (next.players ?? []).map((player: any) => {
        const same = String(player?.character?.id ?? player?.character_id ?? '') === String(body.id);
        return same ? { ...player, character: { ...(player.character ?? {}), ...body }, character_id: body.id } : player;
      });
    }
  }
  return hydrateSessionObjects(next, role);
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

  applyObjectBatch: (sessionId, changes, bodies, userId) => {
    const state = useSessionsStore.getState();
    const current =
      state.sessionsMaster[sessionId]
      ?? state.sessionsPlayer[sessionId]
      ?? state.sessions[sessionId];
    const base = current?.fullSession;
    if (!base) return;

    const role: WsRole | undefined = current?.isMaster ? 'master' : current?.isPlayer ? 'player' : undefined;
    const next = applyBodies(base, changes, bodies, role);
    const enriched = toEnrichedSession(next, userId, role);

    set((state2) => {
      const patch: Partial<SessionsState> = {
        sessions: { ...state2.sessions, [sessionId]: enriched },
      };
      if (role === 'master') {
        patch.sessionsMaster = { ...state2.sessionsMaster, [sessionId]: enriched };
      } else if (role === 'player') {
        patch.sessionsPlayer = { ...state2.sessionsPlayer, [sessionId]: enriched };
      }
      return patch as SessionsState;
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

  patchCharacterPhotos: (sessionId, characterId, photos) =>
    set((state) => {
      const paintBucket = (bucket: Record<string, EnrichedSession>) => {
        const current = bucket[sessionId];
        if (!current?.fullSession) return bucket;
        const nextRaw = paintSessionPhotos(current.fullSession, characterId, photos);
        const role: WsRole | undefined = current.isMaster ? 'master' : current.isPlayer ? 'player' : undefined;
        return {
          ...bucket,
          [sessionId]: toEnrichedSession(nextRaw, undefined, role),
        };
      };
      return {
        sessions: paintBucket(state.sessions),
        sessionsPlayer: paintBucket(state.sessionsPlayer),
        sessionsMaster: paintBucket(state.sessionsMaster),
      };
    }),

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