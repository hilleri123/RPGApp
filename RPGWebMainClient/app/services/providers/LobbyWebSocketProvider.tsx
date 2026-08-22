'use client';

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import { useAuth } from '@/app/services/hooks/useAuth';
import { useLobbiesStore } from '@/app/services/stores/lobbies';
import { lobbyApiService } from '@/app/services/api/lobby';
import type { Lobby, LobbyAction, LobbyErrorMessage, Player } from '@/app/services/types/lobby';
import { toast } from 'sonner';
import { useWsTabResync } from '@/app/services/ws/useWsTabResync';

export interface LobbySocketContextType {
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
  sendAction: (action: LobbyAction) => void;
  lobbyError: LobbyErrorMessage | null;
  clearLobbyError: () => void;
}

export const LobbySocketContext = createContext<LobbySocketContextType | null>(null);

/** Заглушка на случай отсутствия провайдера — см. MISSING_SESSION_SOCKET:
 * условный throw до остальных хуков менял их количество между рендерами. */
export const MISSING_LOBBY_SOCKET: LobbySocketContextType = {
  socket: { current: null },
  connected: false,
  sendAction: () => {
    console.error('LobbySocketContext отсутствует: действие не отправлено');
  },
  lobbyError: null,
  clearLobbyError: () => {},
};

function normalizeLobbyData(data: Lobby): Lobby {
  const imported = ((data as Lobby & { imported_characters?: typeof data.characters }).imported_characters ||
    []) as NonNullable<Lobby['characters']>;
  const characterMap = new Map<string, NonNullable<Lobby['characters']>[number]>();
  for (const c of [...(data.characters || []), ...imported]) {
    characterMap.set(String(c.id), c);
  }
  return {
    ...data,
    players: (data.players || []).map((player) => {
      const cid = player.character_id ? String(player.character_id) : null;
      const aid = player.application_id ? String(player.application_id) : null;
      let character = cid ? characterMap.get(cid) ?? null : null;
      if (!character && aid) {
        for (const ch of characterMap.values()) {
          const appRef = (ch as { application_id?: string }).application_id;
          if (appRef && String(appRef) === aid) {
            character = ch;
            break;
          }
        }
      }
      const normalizedPlayer: Player = {
        ...player,
        character,
      };
      return normalizedPlayer;
    }),
  };
}

export interface LobbyWebSocketProviderProps {
  lobbyId: string;
  children: React.ReactNode;
}

export const LobbyWebSocketProvider = ({ lobbyId, children }: LobbyWebSocketProviderProps) => {
  const router = useRouter();
  const {
    state: { user },
  } = useAuth();

  const updateLobby = useLobbiesStore((state) => state.updateLobby);
  const clearLobby = useLobbiesStore((state) => state.clearLobby);

  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lobbyError, setLobbyError] = useState<LobbyErrorMessage | null>(null);

  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // флаг “провайдер размонтирован/нельзя реконнектиться”
  const disposedRef = useRef(false);
  const lobbyClosedRef = useRef(false);
  const reconnectRef = useRef<() => void>(() => {});

  const cleanupSocket = useCallback((ws: WebSocket | null) => {
    if (!ws) return;
    try {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
    } catch {}
    try {
      ws.close();
    } catch {}
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    lobbyClosedRef.current = false;

    if (!lobbyId || !user) return;

    const connect = () => {
      if (disposedRef.current) return;
      if (!lobbyId || !user) return;

      clearReconnectTimer();

      // на всякий случай закрываем предыдущий сокет
      if (socketRef.current) cleanupSocket(socketRef.current);

      const ws = lobbyApiService.openWebSocket(lobbyId);
      socketRef.current = ws;

      ws.onopen = () => {
        if (disposedRef.current) return;
        setConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (disposedRef.current) return;

        try {
          const rawData = JSON.parse(event.data);

          if (rawData?.msg_type === 'session_started' && rawData?.session_id) {
            router.push(`/session/${rawData.session_id}`);
            return;
          }

          if (rawData?.msg_type === 'lobby_error') {
            const err = rawData as LobbyErrorMessage;
            setLobbyError(err);
            toast.error(err.message);
            return;
          }

          if (rawData?.msg_type === 'lobby_closed') {
            lobbyClosedRef.current = true;
            disposedRef.current = true;
            clearReconnectTimer();
            clearLobby(lobbyId);
            setConnected(false);
            cleanupSocket(socketRef.current);
            socketRef.current = null;
            router.push('/');
            return;
          }

          const data: Lobby = normalizeLobbyData(rawData);
          if (data?.id) {
            updateLobby(data);
          }
        } catch (e) {
          console.error('Failed to parse message', e);
        }
      };

      ws.onclose = () => {
        if (disposedRef.current || lobbyClosedRef.current) return;

        setConnected(false);

        const timeout = Math.min(10000, 1000 * 2 ** reconnectAttemptsRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, timeout);
      };

      ws.onerror = (err) => {
        // не закрываем, если уже размонтированы
        if (disposedRef.current) return;
        console.error('WebSocket error', err);
        // можно не делать ws.close(): обычно после error придёт onclose сам
        try {
          ws.close();
        } catch {}
      };
    };

    connect();
    reconnectRef.current = () => {
      if (disposedRef.current || lobbyClosedRef.current) return;
      connect();
    };

    return () => {
      disposedRef.current = true;
      clearReconnectTimer();

      const ws = socketRef.current;
      socketRef.current = null;

      setConnected(false);
      cleanupSocket(ws);
    };
  }, [lobbyId, user, router, updateLobby, clearLobby, cleanupSocket, clearReconnectTimer]);

  useWsTabResync({
    enabled: !!(lobbyId && user),
    socketRef: socketRef,
    endedRef: lobbyClosedRef,
    reconnectAttemptsRef,
    clearReconnectTimer,
    reconnect: () => reconnectRef.current(),
  });

  const sendAction = useCallback(
    (action: LobbyAction) => {
      const ws = socketRef.current;
      if (ws && connected && ws.readyState === WebSocket.OPEN) {
        setLobbyError(null);
        ws.send(JSON.stringify(action));
      }
    },
    [connected]
  );

  const clearLobbyError = useCallback(() => setLobbyError(null), []);

  const ctxValue = useMemo<LobbySocketContextType>(
    () => ({
      socket: socketRef,
      connected,
      sendAction,
      lobbyError,
      clearLobbyError,
    }),
    [connected, sendAction, lobbyError, clearLobbyError]
  );

  return <LobbySocketContext.Provider value={ctxValue}>{children}</LobbySocketContext.Provider>;
};
