import { LogMoveItem, LogMsg } from "@/app/services/types/logmsg";
import { GameSession, GameSessionBase } from "@/app/services/types/session";
import { GameItem, NPC, PlayerCharacter, Location } from "@/app/services/types2";
import React from "react";
import { DataLogMsgProps } from "./DataLogMsgProps";

interface Props {
  msg: LogMoveItem;
}

export function LogMoveItemMsg(props: Props & DataLogMsgProps) {
  const users = [
    props.session.master,
    ...(props.session.players?.map(player => player.user) ?? [])
  ];

  const userObj = users.find(u => u.id === props.msg.user_id);
  const userName = userObj?.full_name ?? props.msg.user_id;

  const itemObj = props.items?.find(i => i.id === props.msg.item_id);
  const itemName = itemObj?.name ?? props.msg.item_id;

  const getEntity = (character_id?: string, npc_id?: string, location_id?: string) => {
    if (character_id) {
      const charObj = props.characters?.find(c => c.id === character_id);
      return charObj?.name || `персонаж ${character_id}`;
    }
    if (npc_id) {
      const npcObj = props.npcs?.find(n => n.id === npc_id);
      return npcObj?.name || `NPC ${npc_id}`;
    }
    if (location_id) {
      const locObj = props.locations?.find(l => l.id === location_id);
      return locObj?.name || `локация ${location_id}`;
    }
    return "";
  };
  
  const fromEntity = getEntity(
    props.msg.from_character_id,
    props.msg.from_npc_id,
    props.msg.from_location_id,
  );
  const toEntity = getEntity(
    props.msg.to_character_id,
    props.msg.to_npc_id,
    props.msg.to_location_id,
  );
  return (
    <span>
      <b>{userName}</b> переместил предмет <b>{itemName}</b> из {fromEntity} к {toEntity}
    </span>
  );
}
