import type { UUID } from './common';
import type { WithLineage } from './entities';

// --------- notes ---------

// соответствует NoteBase (бэк)
export interface NoteBase {
  name: string;
  text?: string | null;

  allowed_character_shown_json?: UUID[] | null;

  icon_url?: string | null;
  img_url?: string | null;

  tags?: string[] | null;
  parent_note_id?: UUID | null;
  sort_order?: number;
}

export interface NoteCreate extends NoteBase {}

// соответствует Note (бэк)
export interface Note extends NoteBase, WithLineage {
  id: UUID;
  scenario_id: UUID;

  character_shown?: UUID[] | null;
  owner_user_id?: UUID | null;
  owner_role?: 'master' | 'player' | null;
  parent_note_id?: UUID | null;
  sort_order?: number;
}

export interface NoteUpdate extends Note {}
