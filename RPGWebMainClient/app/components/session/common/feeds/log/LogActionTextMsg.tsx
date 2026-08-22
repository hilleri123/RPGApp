import { LogActionText } from "@/app/services/types/logmsg";
import { DataLogMsgProps } from "./DataLogMsgProps";

interface Props {
  msg: LogActionText;
}

export function LogActionTextMsg(props: Props & DataLogMsgProps) {
  const users = [
    props.session.master,
    ...(props.session.players?.map((player) => player.user) ?? []),
  ];
  const userObj = users.find((u) => u.id === props.msg.user_id);
  const userName = userObj?.full_name ?? props.msg.user_id;

  return (
    <span>
      <b>{userName}</b>: {props.msg.text}
    </span>
  );
}
