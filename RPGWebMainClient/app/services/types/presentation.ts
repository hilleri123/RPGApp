import type { SeenDataAccess } from './playerSeen';
import type { GameItem, Location, NPC, PlayerCharacter } from '../types2';

export type PresentedEntityType = 'npc' | 'game_item' | 'player_character' | 'location';

export type PresentedEntityView = {
  presentation_id: string;
  scene_id: string;
  entity_type: PresentedEntityType;
  entity: NPC | GameItem | PlayerCharacter | Location;
  data_access: SeenDataAccess;
};
