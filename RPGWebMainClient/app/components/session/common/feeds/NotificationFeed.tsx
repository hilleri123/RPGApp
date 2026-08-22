// components/session/feeds/NotificationFeed.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BaseFeedRow } from "@/app/components/common/BaseFeedRow";
import { NotificationMsgRenderer } from "./notification/NotificationMsgRenderer";
import {
  SessionNotification,
  NoteShownNotification,
} from "@/app/services/types/session.notification";
import { useCommonSessionWebSocket } from "@/app/services/hooks/useCommonSessionWebSocket";
import { NoteShownModal } from "../notifications/NoteShownModal";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
  fillAvailable?: boolean;
}

export function NotificationFeed({ sessionId, fillAvailable = false }: Props) {
  const {
    session,
    notifications,
  } = useCommonSessionWebSocket(sessionId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(notifications.length);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (notifications.length > prevLen.current) {
      el.scrollTop = 0;
    }
    prevLen.current = notifications.length;
  }, [notifications]);

  const scrollClass = cn(
    "overflow-y-auto bg-gray-950 rounded p-2 space-y-1 text-sm",
    fillAvailable ? "h-full min-h-0" : "max-h-80",
  );

  if (!session) {
    return (
      <div className={cn("overflow-y-auto bg-gray-950 rounded p-2 text-xs text-gray-500", !fillAvailable && "max-h-80")}>
        Уведомления недоступны (сессия ещё не загружена)
      </div>
    );
  }

  const sorted = useMemo(
    () => notifications.filter((n) => n.notif_type !== "note_shown").slice().sort((a, b) => (a.dt < b.dt ? 1 : -1)),
    [notifications]
  );

  const [active, setActive] = useState<SessionNotification | null>(null);
  const closeModal = () => setActive(null);

  return (
    <>
      <div
        ref={scrollRef}
        className={scrollClass}
        style={fillAvailable ? undefined : { minHeight: 120 }}
        tabIndex={0}
      >
        {sorted.map(n => (
          <BaseFeedRow
            key={n.id}
            id={n.id}
            dt={n.dt}
          >
            <button
              type="button"
              className="text-left w-full"
              onClick={() => setActive(n)}
            >
              <NotificationMsgRenderer
                notif={n}
                session={session}
              />
            </button>
          </BaseFeedRow>
        ))}
        {sorted.length === 0 && (
          <div className="text-xs text-gray-500 italic px-2 py-1">
            Уведомлений пока нет
          </div>
        )}
      </div>

      {active && active.notif_type === "note_shown" && (
        <NoteShownModal
          open={true}
          onClose={closeModal}
          notif={(active as NoteShownNotification)}
          sessionId={sessionId}
          initiatorName={""}
        />
      )}
    </>
  );
}
