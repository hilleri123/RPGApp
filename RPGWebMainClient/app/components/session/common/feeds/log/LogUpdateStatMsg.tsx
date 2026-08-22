import { LogUpdateStat } from "@/app/services/types/logmsg";
import { GameSession, GameSessionBase } from "@/app/services/types/session";
import { GameItem, NPC, PlayerCharacter, Location } from "@/app/services/types/scenario";
import React from "react";
import { DataLogMsgProps } from "./DataLogMsgProps";

interface Props {
  msg: LogUpdateStat;
}

export function LogUpdateStatMsg(props: Props & DataLogMsgProps) {
  const users = [
    props.session.master,
    ...(props.session.players?.map(player => player.user) ?? [])
  ];

  const userObj = users.find(u => u.id === props.msg.user_id);
  const userName = userObj?.full_name ?? props.msg.user_id;

  const charObj = props.characters?.find(c => c.id === props.msg.character_id);
  const charName = charObj?.name ?? props.msg.character_id;

  const statObj = charObj?.body?.stats?.find(s => s.id === props.msg.stat_id);
  const skillObj = [...props.rule.skill_groups.flatMap(
    sgroup => sgroup.skills
  )].find(skill => skill.id === statObj?.skill_id)
  const statName = skillObj?.name ?? props.msg.stat_id;

  return (
    <span>
      <b>{userName}</b> изменил <b>{statName}</b> у <b>{charName}</b>: {props.msg.from_value} → <b>{props.msg.to_value}</b>
    </span>
  );
}
