import { createStore } from 'zustand/vanilla';
import { Location } from '../types2';
import { GameSessionBase, Scene } from '../types/session';
import type { PresentedEntityView } from '../types/presentation';

export type ConnState = 'connecting' | 'open' | 'closed' | 'error';

export type ObserverInitMsg = {
  msg_type: 'observer_init';
  session: GameSessionBase;
  location?: Location[];
  polygon_shown?: string[];
  characters?: any[];
  players?: any[];
  locations?: Location[];
  scenes?: Scene[];
  presented_entity?: PresentedEntityView | null;
};

export type ObserverUpdateMsg = {
  msg_type: 'observer_update';
  fields?: string[];
  location?: Location[];
  locations?: Location[];
  scenes?: Scene[];
  polygon_shown?: string[];
  presented_entity?: PresentedEntityView | null;
};

export type ObserverMsg = ObserverInitMsg | ObserverUpdateMsg;

export type ObserverStoreState = {
  code: string;

  conn: ConnState;
  error: string | null;

  session: GameSessionBase | null;
  location: Location | null;
  locations: Location[];
  visiblePolygonIds: string[];
  characters: any[];
  players: any[];
  scenes: Scene[];
  presentedEntity: PresentedEntityView | null;

  lastMsgType: string | null;
  lastUpdateAt: number | null;

  setConn: (conn: ConnState) => void;
  setError: (err: string | null) => void;
  applyMessage: (msg: ObserverMsg) => void;
};

export function createObserverStore(code: string) {
  return createStore<ObserverStoreState>((set, get) => ({
    code,

    conn: 'connecting',
    error: null,

    session: null,
    location: null,
    locations: [],
    visiblePolygonIds: [],
    characters: [],
    players: [],
    scenes: [],
    presentedEntity: null,

    lastMsgType: null,
    lastUpdateAt: null,

    setConn: (conn) => set({ conn }),
    setError: (err) => set({ error: err }),

    applyMessage: (msg) => {
      const now = Date.now();

      if (msg.msg_type === 'observer_init') {
        set({
          session: msg.session ?? null,
          location: msg.location?.[0] ?? null,
          locations: msg.locations ?? [],
          visiblePolygonIds: msg.polygon_shown ?? [],
          characters: msg.characters ?? [],
          players: msg.players ?? [],
          scenes: msg.scenes ?? [],
          presentedEntity: msg.presented_entity ?? null,
          lastMsgType: msg.msg_type,
          lastUpdateAt: now,
        });
        return;
      }

      if (msg.msg_type === 'observer_update') {
        const prev = get();
        const fields = msg.fields ?? null;

        // если fields не указан — обновляем всё что пришло (старое поведение)
        // если fields указан — обновляем только перечисленные поля
        const shouldUpdate = (field: string) =>
          fields === null || fields.includes(field);

        set({
          location: shouldUpdate('location')
            ? (msg.location != null ? (msg.location[0] ?? null) : prev.location)
            : prev.location,

          locations: shouldUpdate('locations')
            ? (msg.locations != null ? msg.locations : prev.locations)
            : prev.locations,

          visiblePolygonIds: shouldUpdate('polygon_shown')
            ? (msg.polygon_shown != null ? msg.polygon_shown : prev.visiblePolygonIds)
            : prev.visiblePolygonIds,

          scenes: shouldUpdate('scenes')
            ? (msg.scenes != null ? msg.scenes : prev.scenes)
            : prev.scenes,

          presentedEntity: shouldUpdate('presented_entity')
            ? (msg.presented_entity !== undefined ? (msg.presented_entity ?? null) : prev.presentedEntity)
            : prev.presentedEntity,

          // characters: shouldUpdate('characters')
          //   ? (msg.characters != null ? msg.characters : prev.characters)
          //   : prev.characters,

          // players: shouldUpdate('players')
          //   ? (msg.players != null ? msg.players : prev.players)
          //   : prev.players,

          lastMsgType: msg.msg_type,
          lastUpdateAt: now,
        });
        return;
      }
    },
  }));
}

export type ObserverStore = ReturnType<typeof createObserverStore>;
