'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';

import { observerApiService } from '@/app/services/api/observer';
import { createObserverStore, ObserverMsg, ObserverStore, ObserverStoreState } from '../stores/observer';
import { useWsTabResync } from '@/app/services/ws/useWsTabResync';


const ObserverStoreContext = createContext<ObserverStore | null>(null);

export function useObserverStore<T>(selector: (s: ObserverStoreState) => T): T {
  const store = useContext(ObserverStoreContext);
  if (!store) throw new Error('useObserverStore must be used within ObserverWsProvider');
  return useStore(store, selector);
}

function isObserverMsg(x: any): x is ObserverMsg {
  return x && typeof x === 'object' && (x.msg_type === 'observer_init' || x.msg_type === 'observer_update');
}

export function ObserverWsProvider({
  code,
  children,
  reconnectMs = 1500,
}: {
  code: string;
  children: React.ReactNode;
  reconnectMs?: number;
}) {
  const store = useMemo(() => createObserverStore(code), [code]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const shouldRunRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);
  const reconnectRef = useRef<() => void>(() => {});

  useEffect(() => {
    shouldRunRef.current = true;

    const clearReconnect = () => {
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const closeWs = () => {
      const ws = wsRef.current;
      wsRef.current = null;
      if (!ws) return;
      try {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      } catch {}
    };

    const connect = () => {
      clearReconnect();
      closeWs();

      store.getState().setConn('connecting');
      store.getState().setError(null);

      let ws: WebSocket;
      try {
        ws = observerApiService.openWebSocket(code);
      } catch (e) {
        store.getState().setConn('error');
        store.getState().setError(e instanceof Error ? e.message : 'Не удалось открыть WebSocket.');
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        store.getState().setConn('open');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data));
          if (isObserverMsg(data)) {
            store.getState().applyMessage(data);
          }
        } catch {
          // ignore non-json
        }
      };

      ws.onerror = () => {
        store.getState().setConn('error');
        store.getState().setError('Ошибка WebSocket.');
      };

      ws.onclose = () => {
        store.getState().setConn('closed');

        if (!shouldRunRef.current) return;
        const timeout = Math.min(10000, 1000 * 2 ** reconnectAttemptsRef.current);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(() => {
          if (!shouldRunRef.current) return;
          connect();
        }, timeout);
      };
    };

    connect();
    reconnectRef.current = () => {
      if (!shouldRunRef.current) return;
      connect();
    };

    return () => {
      shouldRunRef.current = false;
      clearReconnect();
      closeWs();
    };
  }, [code, reconnectMs, store]);

  useWsTabResync({
    enabled: true,
    socketRef: wsRef,
    reconnectAttemptsRef,
    clearReconnectTimer: () => {
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    },
    reconnect: () => reconnectRef.current(),
  });

  return <ObserverStoreContext.Provider value={store}>{children}</ObserverStoreContext.Provider>;
}
