import { Player } from '../types/lobby';
import type { UUID } from './common';
import type { EntityData, Issue, UpsertResult, WithLineage } from './entities';
import type { ItemContainedLinkIn, GameItemOut } from './item';


// --------- character models ---------

// соответствует PlayerCharacterBase (бэк)
export interface PlayerCharacterBase {
  name: string;
  short_desc?: string | null;
  story?: string | null;

  location_id?: UUID | null;
  /** User who plays this character in the launched scenario (lobby prefill). */
  bound_user_id?: UUID | null;

  icon_url?: string | null;
  img_url?: string | null;
  tags?: string[];
}

// соответствует PlayerCharacterOut (бэк)
export interface PlayerCharacterOut extends PlayerCharacterBase, WithLineage {
  id: UUID;
  // scenario_id: UUID;
  bound_user_id?: UUID | null;
  owned_items: GameItemOut[];
}

// соответствует PlayerCharacter (бэк) = Out + data
export interface PlayerCharacter extends PlayerCharacterOut {
  data: EntityData;
  player?: Player;
}

// соответствует PlayerCharacterList (бэк)
export interface PlayerCharacterList extends PlayerCharacterBase {
  id: UUID;
}

// --------- upsert ---------

export interface CharacterUpsertPayload extends PlayerCharacterBase {
  force?: boolean; // default false
  data: EntityData;
  owned_items?: ItemContainedLinkIn[]; // default []
}

export interface CharacterUpsertResult extends UpsertResult {
  character: PlayerCharacterOut | null;
}
