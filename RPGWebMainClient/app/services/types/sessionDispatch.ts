import { Note } from '../types2';

export interface SessionDispatch {
  id: string;
  sent_at: string;
  sender_id: string;
  sender_role: 'master' | 'player';
  sender_name?: string | null;
  note: Note;
  recipient_user_ids: string[];
  recipient_character_ids?: string[];
  tags: string[];
  read_by?: string[];
  read_at_by?: Record<string, string>;
  revoked_at?: string | null;
  edited_at?: string | null;
  edited_by?: string | null;
}

export interface CampaignSessionHistoryItem {
  session_id: string;
  session_name: string;
  campaign_id?: string | null;
  campaign_name?: string | null;
  step_index?: number | null;
  total_steps?: number | null;
  created_at?: string | null;
  finished_at?: string | null;
  role: string;
  is_active: boolean;
}

export interface CampaignProfile {
  as_master: import('./campaign').Campaign[];
  session_history: CampaignSessionHistoryItem[];
}
