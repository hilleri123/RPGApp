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
 * When the tab goes to background the browser may drop the socket.
 * On return we reconnect only if it is already closed. An open socket keeps
 * receiving object_changes and does not reload the whole session.
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
      if (ws && ws.readyState === WebSocket.OPEN) return;

      reconnectAttemptsRef.current = 0;
      clearReconnectTimer();
      reconnect();
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
