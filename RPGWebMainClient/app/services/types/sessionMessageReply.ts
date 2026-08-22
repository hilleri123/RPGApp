export interface SessionMessageReply {
  id: string;
  note_id: string;
  author_id: string;
  author_role: 'master' | 'player';
  author_name?: string | null;
  text: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
}
