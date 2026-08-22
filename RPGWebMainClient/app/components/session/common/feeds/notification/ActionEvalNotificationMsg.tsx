// components/session/feeds/notification/ActionEvalNotificationMsg.tsx
import React from "react";
import { ActionEvalNotification } from "@/app/services/types/session.notification";
import { GameSessionBase } from "@/app/services/types/session";
import { FullRule } from "@/app/services/types/rules";
import { getUserNameById } from "./userName";

interface Props {
  notif: ActionEvalNotification;
  session: GameSessionBase;
  rule: FullRule;
}

export function ActionEvalNotificationMsg({ notif, session }: Props) {
  const userName = getUserNameById(session, notif.initiator_id);

  return (
    <span>
      <b>{userName}</b> выполнил действие{" "}
      <b>{notif.action.description_for_players}</b>
    </span>
  );
}
