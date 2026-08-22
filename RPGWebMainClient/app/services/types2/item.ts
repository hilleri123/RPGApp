import type { UUID } from './common';
import type { EntityData, UpsertResult, WithLineage } from './entities';

// --------- links ---------


export interface ItemContainedLinkIn {
  item_id: UUID;
  take_from_other_owner?: boolean;
}

export interface ItemContainedIn extends ItemContainedLinkIn {
  item: GameItemList;
}


// --------- item models ---------

// соответствует GameItemBase (бэк)
export interface GameItemBase {
  name: string;
  description_for_master?: string | null;
  description_for_players?: string | null;

  icon_url?: string | null;
  img_url?: string | null;

  quest_html_mark?: string;
  tags?: string[];
}

// соответствует GameItemOut (бэк)
export interface GameItemOut extends GameItemBase, WithLineage {
  id: UUID;
  // scenario_id: UUID;

  // на бэке это называется owned_items: list[GameItemItemLinkOut]
  owned_items: GameItemOut[];
}

// соответствует GameItem (бэк) = Out + data
export interface GameItem extends GameItemOut {
  data: EntityData;
}

// соответствует GameItemList (бэк)
export interface GameItemList extends GameItemBase {
  id: UUID;
}

// --------- upsert ---------

export interface ItemUpsertPayload extends GameItemBase {
  force?: boolean; // default false
  data: EntityData;
  contained_items?: ItemContainedLinkIn[]; // default []
}

export interface ItemUpsertResult extends UpsertResult {
  item: GameItemOut | null;
}

// --------- owner -------------

export type ItemOwnerType = 'character' | 'npc' | 'item';

export type ItemOwnerShort = {
  type: ItemOwnerType;
  id: string;
  name: string;
  icon_url?: string | null;
  img_url?: string | null;
};

export interface GameItemWithOwnerShort extends GameItemList {
  owner?: ItemOwnerShort | null;
  exposure_names?: string[];
};
