import type { UUID } from './common';
import type { EntityData, Issue, UpsertResult, WithLineage } from './entities';
import type { ItemContainedLinkIn, GameItemOut } from './item';

// --------- npc models ---------

// соответствует NPCBase (бэк)
export interface NPCBase {
  name: string;
  description_for_master?: string | null;
  description_for_players?: string | null;
  tags?: string[];

  icon_url?: string | null;
  img_url?: string | null;
}

// соответствует NPCOut (бэк)
export interface NPCOut extends NPCBase, WithLineage {
  id: UUID;
  // scenario_id: UUID;
  owned_items: GameItemOut[];
}

// соответствует NPC (бэк) = Out + data
export interface NPC extends NPCOut {
  data: EntityData;
}

// соответствует NPCList (бэк)
export interface NPCList extends NPCBase, WithLineage {
  id: UUID;
  exposure_names?: string[];
}

// --------- upsert ---------

export interface NPCUpsertPayload extends NPCBase {
  force?: boolean; // default false
  data: EntityData;
  owned_items?: ItemContainedLinkIn[]; // default []
}

export interface NPCUpsertResult extends UpsertResult {
  npc: NPCOut | null;
}
