import { LogMoveItem, LogMsg, LogUpdateStat, LogActionText, LogRoll } from "@/app/services/types/logmsg";
import { GameSession, GameSessionBase } from "@/app/services/types/session";
import { LogUpdateStatMsg } from "./LogUpdateStatMsg";
import { LogMoveItemMsg } from "./LogMoveItemMsg";
import { LogActionTextMsg } from "./LogActionTextMsg";
import { LogRollMsg } from "./LogRollMsg";
import { GameItem, NPC, PlayerCharacter, Location } from "@/app/services/types2";

import { DataLogMsgProps } from "./DataLogMsgProps";



interface LogMsgRendererProps {
  msg: LogMsg;
}

export function LogMsgRenderer(props: LogMsgRendererProps & DataLogMsgProps) {
  const {msg, ...other} = props;
  if ("update_stat" == props.msg.log_type) {
    return (
      <LogUpdateStatMsg
        msg={props.msg as LogUpdateStat}
        {...other}
      />
    );
  }
  if ("item_move" == props.msg.log_type) {
    return (
      <LogMoveItemMsg
        msg={props.msg as LogMoveItem}
        {...other}
      />
    );
  }
  if ("action_text" == props.msg.log_type) {
    return (
      <LogActionTextMsg
        msg={props.msg as LogActionText}
        {...other}
      />
    );
  }
  if ("roll" == props.msg.log_type) {
    return (
      <LogRollMsg
        msg={props.msg as LogRoll}
        {...other}
      />
    );
  }
  return <span>Неизвестное действие</span>;
}