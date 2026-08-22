// components/session/feeds/notification/UseEvalNotificationMsg.tsx
import React from "react";
import { UseEvalNotification } from "@/app/services/types/session.notification";
import { GameSessionBase } from "@/app/services/types/session";
import { FullRule } from "@/app/services/types/rules";
import { getUserNameById } from "./userName";

interface Props {
  notif: UseEvalNotification;
  session: GameSessionBase;
  rule: FullRule;
}

export function UseEvalNotificationMsg({ notif, session }: Props) {
  const userName = getUserNameById(session, notif.initiator_id);

  return (
    <span>
      <b>{userName}</b> использует <b>{notif.item.name}</b> ({notif.use.name})
    </span>
  );
}
