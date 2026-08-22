export interface ObserverRoomPreview {
  code: string;
  session_id: string;
  session_name: string;
  scenario_name: string;
  master_name: string;
  player_count: number;
  rule_id_str: string;
  created_at?: string | null;
}

export type ObserverRoomSort = 'name' | 'scenario' | 'master' | 'players' | 'created';
export type ObserverRoomSortOrder = 'asc' | 'desc';
