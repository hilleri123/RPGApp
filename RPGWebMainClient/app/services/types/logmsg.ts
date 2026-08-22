
export interface LogMsgBase {
  id: string;
  user_id: string;
  log_type: string;
  dt?: string;
}


export interface LogUpdateStat extends LogMsgBase {
  log_type: 'update_stat';
  character_id: string;
  stat_id: string;
  from_value: number;
  to_value: number;
}

export interface LogMoveItem extends LogMsgBase {
  log_type: 'item_move';
  item_id: string;
  from_character_id?: string;
  from_location_id?: string;
  from_npc_id?: string;
  to_character_id?: string;
  to_location_id?: string;
  to_npc_id?: string;
}

export interface LogActionText extends LogMsgBase {
  log_type: 'action_text';
  text: string;
  action_id?: string;
  action_key?: string;
  tags?: string[];
}

export interface LogRoll extends LogMsgBase {
  log_type: 'roll';
  action_id?: string;
  action_key?: string;
  title?: string;
  roll_kind?: string;
  dice?: number[];
  total?: number | null;
  outcome?: string | null;
  seed?: string | null;
  meta?: Record<string, unknown>;
}


export type LogMsg =
 | LogUpdateStat
 | LogMoveItem
 | LogActionText
 | LogRoll
 ;
