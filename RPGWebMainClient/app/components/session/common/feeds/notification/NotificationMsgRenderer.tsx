// components/session/feeds/notification/NotificationMsgRenderer.tsx
import React from "react";
import {
  SessionNotification,
  NoteShownNotification,
} from "@/app/services/types/session.notification";
import { GameSessionBase } from "@/app/services/types/session";
import { NoteShownNotificationMsg } from "./NoteShownNotificationMsg";

export interface NotificationMsgRendererProps {
  notif: SessionNotification;
  session: GameSessionBase;
}

export function NotificationMsgRenderer(props: NotificationMsgRendererProps) {
  const { notif, session } = props;

  if (notif.notif_type === "note_shown") {
    return (
      <NoteShownNotificationMsg
        notif={notif as NoteShownNotification}
        session={session}
      />
    );
  }

  return <span>Неизвестное уведомление</span>;
}
