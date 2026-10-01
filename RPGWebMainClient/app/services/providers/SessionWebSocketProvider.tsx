'use client';

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from "next/navigation";


import { useAuth } from '@/app/services/hooks/useAuth';
import { useSessionsStore } from '../stores/sessions';
import { sessionApiService } from '../api/session';

import type { SessionActionBase, SessionActionRPC } from '../types/session';
import type {
  SessionInitMessage,
  SessionUpdateMessage,
  SessionWsMessage,
  RpcResult,
} from '../types/session.ws';

import { getPluginUI } from '@/app/plugins/uiRegistry';
import { useWsTabResync } from '@/app/services/ws/useWsTabResync';
import { toast } from 'sonner';

export type RpcOptions = { timeoutMs?: number };

export interface SessionSocketContextType {
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;

  /** true — ушло в сокет, false — отложено до переподключения. */
  sendAction: (action: SessionActionBase) => boolean;
  sendRequest: <T = any>(action: SessionActionRPC, opts?: RpcOptions) => Promise<T>;

  pluginUI: any | null;
  ruleIdStr: string | null;
}

export const SessionSocketContext = createContext<SessionSocketContextType | null>(null);

/** Заглушка на случай отсутствия провайдера.
 *
 * Хуки-потребители не могут бросать здесь исключение: throw стоял до десятков
 * useCallback ниже, из-за чего количество вызванных хуков зависело от условия.
 * Если провайдер размонтируется раньше потребителя (навигация, hot reload,
 * Suspense), React падал с «rendered fewer hooks than expected» — сообщением,
 * которое не говорит о настоящей причине. */
export const MISSING_SESSION_SOCKET: SessionSocketContextType = {
  socket: { current: null },
  connected: false,
  sendAction: () => {
    console.error('SessionSocketContext отсутствует: действие не отправлено');
    return false;
  },
  sendRequest: () =>
    Promise.reject(new Error('SessionSocketContext отсутствует: провайдер не обёрнут')),
  pluginUI: null,
  ruleIdStr: null,
};

interface SessionWebSocketProviderProps {
  sessionId: string;
  children: React.ReactNode;
  /** When true, sendAction/sendRequest are no-ops (GM player-eyes mirror). */
  commandReadOnly?: boolean;
}

export const SessionWebSocketProvider = ({
  sessionId,
  children,
  commandReadOnly = false,
}: SessionWebSocketProviderProps) => {
  const {
    state: { user },
  } = useAuth();
  const router = useRouter();

  const { setWsInit, patchWsUpdate, removeSession } = useSessionsStore();

  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [finished, setFinished] = useState(false);

  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const disposedRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const reconnectRef = useRef<() => void>(() => {});

  // RPC pending map
  const pendingRef = useRef(
    new Map<
      string,
      { resolve: (v: any) => void; reject: (e: any) => void; timer: ReturnType<typeof setTimeout> }
    >()
  );

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const failAllPending = useCallback((err: Error) => {
    for (const [rid, pr] of pendingRef.current.entries()) {
      clearTimeout(pr.timer);
      pr.reject(err);
      pendingRef.current.delete(rid);
    }
  }, []);

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

  // Действия, которые не удалось отправить, ждут в очереди — раньше они молча
  // исчезали, и для игрока это выглядело как проигнорированное нажатие.
  //
  // Кроме того, мы помним отправленные, но ещё не подтверждённые (`action_ack`)
  // действия: если связь оборвалась, неизвестно, дошли ли они. После переподключения
  // шлём их повторно — сервер по `client_msg_id` отбросит дубликат (FE-03).
  const outboxRef = useRef<SessionActionBase[]>([]);
  const inflightRef = useRef<Map<string, { action: SessionActionBase; sentAt: number }>>(new Map());
  const OUTBOX_LIMIT = 50;
  const INFLIGHT_MAX_AGE_MS = 10 * 60 * 1000;

  const newMsgId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const flushOutbox = useCallback(() => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const now = Date.now();
    const pending = outboxRef.current;
    outboxRef.current = [];

    // Неподтверждённые ушли в прошлый сокет — повторяем (дубликаты отсекает сервер).
    const resend: SessionActionBase[] = [];
    inflightRef.current.forEach((entry, id) => {
      if (now - entry.sentAt > INFLIGHT_MAX_AGE_MS) inflightRef.current.delete(id);
      else resend.push(entry.action);
    });

    for (const action of [...resend, ...pending]) {
      try {
        ws.send(JSON.stringify(action));
        const id = (action as { client_msg_id?: string }).client_msg_id;
        if (id) inflightRef.current.set(id, { action, sentAt: now });
      } catch {
        if (!resend.includes(action)) outboxRef.current.push(action);
      }
    }
    if (pending.length && !outboxRef.current.length) {
      toast.success(`Отложенные действия отправлены: ${pending.length}`);
    }
  }, []);

  const sendAction = useCallback(
    (rawAction: SessionActionBase): boolean => {
      if (commandReadOnly) {
        toast.message('Режим «глаза игрока»: команды не отправляются', {
          id: 'player-mirror-readonly',
        });
        return false;
      }
      const action = {
        ...rawAction,
        client_msg_id: (rawAction as { client_msg_id?: string }).client_msg_id ?? newMsgId(),
      } as SessionActionBase;
      const msgId = (action as { client_msg_id?: string }).client_msg_id as string;

      const ws = socketRef.current;
      if (ws && connected && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(action));
          inflightRef.current.set(msgId, { action, sentAt: Date.now() });
          return true;
        } catch {
          // Провалимся в ветку с очередью ниже.
        }
      }

      if (outboxRef.current.length >= OUTBOX_LIMIT) {
        toast.error('Связь потеряна, очередь действий переполнена');
        return false;
      }

      outboxRef.current.push(action);
      toast.warning('Связь потеряна — действие отправится после переподключения');
      return false;
    },
    [connected, commandReadOnly]
  );

  const sendRequest = useCallback(
    <T,>(action: SessionActionBase, opts?: RpcOptions): Promise<T> => {
      if (commandReadOnly) {
        toast.message('Режим «глаза игрока»: команды не отправляются', {
          id: 'player-mirror-readonly',
        });
        return Promise.reject(new Error('Player mirror is read-only'));
      }
      const timeoutMs = opts?.timeoutMs ?? 8000;

      const request_id =
        globalThis.crypto && 'randomUUID' in globalThis.crypto
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const payload: any = { ...action, request_id };

      return new Promise<T>((resolve, reject) => {
        const ws = socketRef.current;

        if (!ws || !connected || ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WS not connected'));
          return;
        }

        const timer = setTimeout(() => {
          pendingRef.current.delete(request_id);
          reject(new Error('WS request timeout'));
        }, timeoutMs);

        pendingRef.current.set(request_id, { resolve, reject, timer });

        try {
          ws.send(JSON.stringify(payload));
        } catch (e) {
          clearTimeout(timer);
          pendingRef.current.delete(request_id);
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });
    },
    [connected, commandReadOnly]
  );

  // plugin UI
  const ruleIdStr = useSessionsStore((st) => {
    const sess: any = st.sessions[sessionId]?.session;
    return (sess?.rule_id_str ?? null) as string | null;
  });

  const pluginUI = useMemo(() => (ruleIdStr ? getPluginUI(ruleIdStr) : null), [ruleIdStr]);

  useEffect(() => {
    disposedRef.current = false;
    sessionEndedRef.current = false;

    if (!sessionId || !user) return;

    const connect = () => {
      if (disposedRef.current) return;
      if (!sessionId || !user) return;

      clearReconnectTimer();

      // закрыть предыдущий сокет, если остался
      if (socketRef.current) cleanupSocket(socketRef.current);

      const ws = sessionApiService.openWebSocket(sessionId);
      socketRef.current = ws;

      ws.onopen = () => {
        if (disposedRef.current) return;
        setConnected(true);
        reconnectAttemptsRef.current = 0;
        flushOutbox();
      };

      ws.onmessage = (event) => {
        if (disposedRef.current) return;

        try {
          const data = JSON.parse(event.data) as SessionWsMessage;
          if (!data || !('msg_type' in data)) return;

          if ((data as { msg_type: string }).msg_type === 'action_ack') {
            const id = (data as unknown as { client_msg_id?: string }).client_msg_id;
            if (id) inflightRef.current.delete(id);
            return;
          }

          if (data.msg_type === 'rpc_result') {
            const msg = data as RpcResult;
            const pr = pendingRef.current.get(msg.request_id);
            if (pr) {
              clearTimeout(pr.timer);
              pendingRef.current.delete(msg.request_id);

              if (msg.ok) pr.resolve(msg.data);
              else pr.reject(new Error(msg.error || 'RPC error'));
            }
            return;
          }

          // СЕССИЯ ЗАВЕРШЕНА
          if (data.msg_type === "session_finished") {
            toast.info('Сессия завершена');
            sessionEndedRef.current = true;
            setFinished(true);
            setConnected(false);
            clearReconnectTimer();
            failAllPending(new Error("Session finished"));

            const ws = socketRef.current;
            if (ws) {
              cleanupSocket(ws);
              socketRef.current = null;
            }

            setTimeout(() => {
              if (!disposedRef.current) {
                router.push("/");
              }
            }, 1500);
            return;
          }

          // СЕССИЯ НЕ НАЙДЕНА
          if (data.msg_type === "session_not_found") {
            toast.error('Сессия не найдена');
            sessionEndedRef.current = true;
            setConnected(false);
            clearReconnectTimer();
            failAllPending(new Error("Session not found"));

            const ws = socketRef.current;
            if (ws) {
              cleanupSocket(ws);
              socketRef.current = null;
            }

            // здесь можно редиректить сразу, без задержки или с короткой
            setTimeout(() => {
              if (!disposedRef.current) {
                router.push("/");
              }
            }, 500);
            return;
          }

          // ВОЗВРАТ В ЛОББИ
          if (data.msg_type === "session_return_to_lobby") {
            const { lobby_id } = data;

            toast.info('Возврат в лобби');
            sessionEndedRef.current = true;
            setConnected(false);
            clearReconnectTimer();
            failAllPending(new Error("Session returned to lobby"));

            const ws = socketRef.current;
            if (ws) {
              cleanupSocket(ws);
              socketRef.current = null;
            }

            // если хочешь, можно показать какой-то тост перед переходом
            setTimeout(() => {
              if (!disposedRef.current) {
                router.push(`/lobby/${lobby_id}`);
              }
            }, 500);
            return;
          }


          if (data.msg_type === 'session_init') {
            setWsInit(data as SessionInitMessage, user.id);
            return;
          }

          if (data.msg_type === 'session_update') {
            patchWsUpdate({ ...(data as SessionUpdateMessage), session_id: sessionId } as any, user.id);
            return;
          }
        } catch (e) {
          console.error('Failed to parse message', e);
        }
      };

      ws.onclose = () => {
        if (disposedRef.current) return;

        setConnected(false);
        failAllPending(new Error('WS closed'));

        if (finished || sessionEndedRef.current) {
          // завершённая/недоступная сессия — без реконнекта
          return;
        }

        const timeout = Math.min(10000, 1000 * 2 ** reconnectAttemptsRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, timeout);
      };

      ws.onerror = (err) => {
        if (disposedRef.current) return;
        console.error('WebSocket error', err);
        // можно не закрывать, но если хочешь — закрывай, reconnection пойдёт через onclose
        try {
          ws.close();
        } catch {}
      };
    };

    connect();
    reconnectRef.current = () => {
      if (disposedRef.current || sessionEndedRef.current) return;
      connect();
    };

    return () => {
      disposedRef.current = true;

      clearReconnectTimer();

      // важное: отклоняем все RPC, чтобы не висели промисы после unmount
      failAllPending(new Error('WS provider disposed'));

      const ws = socketRef.current;
      socketRef.current = null;

      setConnected(false);
      cleanupSocket(ws);
    };
  }, [
    sessionId,
    user,
    setWsInit,
    patchWsUpdate,
    clearReconnectTimer,
    cleanupSocket,
    failAllPending,
    flushOutbox,
  ]);

  // Отдельным эффектом, а не в cleanup подключения: тот перезапускается при
  // смене user и стёр бы данные живой сессии. Здесь очистка срабатывает только
  // при уходе с сессии — иначе полные копии GameSession копились бы в памяти.
  useEffect(
    () => () => {
      removeSession(sessionId);
    },
    [sessionId, removeSession],
  );

  useWsTabResync({
    enabled: !!(sessionId && user),
    socketRef,
    endedRef: sessionEndedRef,
    reconnectAttemptsRef,
    clearReconnectTimer,
    reconnect: () => reconnectRef.current(),
  });

  const ctxValue = useMemo<SessionSocketContextType>(
    () => ({
      socket: socketRef,
      connected,
      sendAction,
      sendRequest,
      pluginUI,
      ruleIdStr,
    }),
    [connected, sendAction, sendRequest, pluginUI, ruleIdStr]
  );

  return <SessionSocketContext.Provider value={ctxValue}>{children}</SessionSocketContext.Provider>;
};
