import React, { useState, useMemo, useEffect } from "react";
import { useSessionWebSocket } from "@/app/services/hooks/useSessionWebSocket";
import { SessionNotification, NoteShownNotification } from "@/app/services/types/session.notification";
import { useAuth } from "@/app/services";
import { GameSessionBase } from "@/app/services/types/session";
import { usePlayerSessionWebSocket } from "@/app/services/hooks/usePlayerSessionWebSocket";
import { useCommonSessionWebSocket } from "@/app/services/hooks/useCommonSessionWebSocket";
import { NoteShownModal } from "./notifications/NoteShownModal";


function getUserNameById(session: GameSessionBase | undefined, userId: string): string {
  if (!session) return userId;
  if (session.master.id === userId) {
    return session.master.full_name || session.master.email || userId;
  }
  const player = session.players.find(p => p.user.id === userId);
  if (player) {
    return player.user.full_name || player.user.email || userId;
  }
  return userId;
}



export function NotificationCenter({ sessionId }: { sessionId: string }) {
  const { 
    notifications,
    session,
    readNotififcations 
  } = useCommonSessionWebSocket(sessionId);

  const { state, logout } = useAuth();
  const { user, loading } = state;

  // Храним в state id уже ПОКАЗАННЫХ (на этом маунте)
  const [seen, setSeen] = useState<string[]>([]);
  const unread = useMemo(
    () =>
      notifications.filter(n => {
        if (n.notif_type === "note_shown") return false;
        if (!user) return false;
        const recips = n.recipients ?? [];
        // показываем только тем, кто в recipients
        if (!recips.includes(user.id)) return false;
        const read = n.readed_by ?? [];
        if (read.includes(user.id)) return false;
        if (seen.includes(n.id)) return false;
        return true;
      }),
    [notifications, seen, user]
  );

  // Следующая непрочитанная
  const [current, setCurrent] = useState<SessionNotification | null>(null);
  useEffect(() => {
    if (!current && unread.length > 0) setCurrent(unread[0]);
  }, [unread, current]);

  // После показа - отмечаем как просмотренную в локальном массиве
  const handleClose = () => {
    if (current) {
      setSeen(prev => [...prev, current.id]);
      readNotififcations([current.id]);
    }
    setCurrent(null);
  };

  if (!current) return null;


  if (current.notif_type === "note_shown") {
    const n = current as NoteShownNotification;

    return (
      <NoteShownModal
        open={true}
        onClose={handleClose}
        notif={n}
        sessionId={sessionId}
        initiatorName={getUserNameById(session, n.initiator_id)}
      />
    );
  }
  // Фолбек для других типов
  return (
    <div
      style={{
        background: "#333",
        color: "#fff",
        padding: 16,
        borderRadius: 8,
        minWidth: 320,
        maxWidth: "80vw"
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 8 }}>
        Новое уведомление: 
      </div>
      <button onClick={handleClose} style={{
        marginTop: 8,
        background: "#555",
        color: "#fff",
        border: "none",
        borderRadius: 4,
        padding: "4px 16px",
        cursor: "pointer"
      }}>Ок</button>
    </div>
  );
}
