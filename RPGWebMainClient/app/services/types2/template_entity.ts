export type TemplateEntityBrowseItem = {
  id: string;
  name: string;
  tags?: string[];
  template_pack_id?: string | null;
  template_pack_name?: string | null;
};

export type ScenarioTemplateListItem = TemplateEntityBrowseItem & {
  is_direct_link?: boolean;
  is_primary_pack?: boolean;
  can_delete?: boolean;
  can_unlink?: boolean;
};

export type TemplateEntityKind = 'npc' | 'game_item' | 'player_character';
