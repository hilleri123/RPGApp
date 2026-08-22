// components/session/feeds/notification/UseEvalNotificationMsg.tsx
import React from "react";
import { NoteShownNotification } from "@/app/services/types/session.notification";
import { GameSessionBase } from "@/app/services/types/session";
import { getUserNameById } from "./userName";

interface Props {
  notif: NoteShownNotification;
  session: GameSessionBase;
}

export function NoteShownNotificationMsg({ notif, session }: Props) {
  const userName = getUserNameById(session, notif.initiator_id);

  return (
    <span>
      Доступна заметка ({notif.note.name})
    </span>
  );
}
