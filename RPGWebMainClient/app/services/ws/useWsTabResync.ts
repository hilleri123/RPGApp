import { useEffect, type MutableRefObject } from 'react';

type UseWsTabResyncOptions = {
  enabled: boolean;
  socketRef: MutableRefObject<WebSocket | null>;
  endedRef?: MutableRefObject<boolean>;
  reconnectAttemptsRef: MutableRefObject<number>;
  clearReconnectTimer: () => void;
  reconnect: () => void;
};

/**
 * When the tab goes to background the browser may suspend the socket or drop
 * messages. On return we reconnect or ask the server for a full state snapshot.
 */
export function useWsTabResync({
  enabled,
  socketRef,
  endedRef,
  reconnectAttemptsRef,
  clearReconnectTimer,
  reconnect,
}: UseWsTabResyncOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleResume = () => {
      if (document.visibilityState !== 'visible') return;
      if (endedRef?.current) return;

      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reconnectAttemptsRef.current = 0;
        clearReconnectTimer();
        reconnect();
        return;
      }

      try {
        ws.send(JSON.stringify({ msg_type: 'request_sync' }));
      } catch {
        reconnectAttemptsRef.current = 0;
        clearReconnectTimer();
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
    };
  }, [
    enabled,
    socketRef,
    endedRef,
    reconnectAttemptsRef,
    clearReconnectTimer,
    reconnect,
  ]);
}
