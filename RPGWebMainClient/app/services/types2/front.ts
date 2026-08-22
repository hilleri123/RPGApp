export type FrontEntityType = 'npc' | 'story_beat' | 'item' | 'counter' | 'location';
export type ScenarioTagKind = 'manual' | 'front';

export interface ScenarioTag {
  id: string;
  scenario_id: string;
  key: string;
  label: string;
  description?: string | null;
  color?: string | null;
  kind: ScenarioTagKind;
  front_id?: string | null;
}

export interface ScenarioTagCreate {
  key: string;
  label: string;
  description?: string | null;
  color?: string | null;
  kind?: ScenarioTagKind;
}

export interface ScenarioTagUpdate {
  key?: string;
  label?: string;
  description?: string | null;
  color?: string | null;
}

export interface FrontMember {
  id: string;
  front_id: string;
  entity_type: FrontEntityType;
  entity_id: string;
}

export interface FrontWikiNote {
  id: string;
  front_id: string;
  note_id: string;
  sort_order: number;
  note_name?: string | null;
}

export interface FrontWikiTreeNode {
  note_id: string;
  note_name?: string | null;
  parent_note_id?: string | null;
  sort_order: number;
  depth: number;
  implied: boolean;
  link_id?: string | null;
}

export interface Front {
  id: string;
  scenario_id: string;
  name: string;
  description_for_master?: string | null;
  color: string;
  icon_url?: string | null;
  tag_id: string;
  tag_key?: string | null;
  members: FrontMember[];
  wiki_notes: FrontWikiNote[];
  wiki_tree?: FrontWikiTreeNode[];
  wiki_note_count?: number;
}

export interface FrontListItem {
  id: string;
  scenario_id: string;
  name: string;
  description_for_master?: string | null;
  color: string;
  icon_url?: string | null;
  tag_id: string;
  tag_key?: string | null;
  member_count: number;
  wiki_note_count: number;
}

export interface FrontCreate {
  name: string;
  description_for_master?: string | null;
  color?: string;
  icon_url?: string | null;
}

export interface FrontUpdate {
  name?: string;
  description_for_master?: string | null;
  color?: string;
  icon_url?: string | null;
}

/** Front membership badge for entity cards (master-only). */
export interface FrontBadgeInfo {
  id: string;
  name: string;
  color: string;
  icon_url?: string | null;
  tag_key?: string | null;
}
