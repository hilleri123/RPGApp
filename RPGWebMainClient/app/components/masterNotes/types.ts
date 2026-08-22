import type { GameItem, Location, Note, NPC, PlayerCharacter } from '@/app/services/types2';

export interface MasterNoteEntityCatalog {
  npcs: NPC[];
  items: GameItem[];
  characters: PlayerCharacter[];
  locations: Location[];
  notes: Note[];
}

export type MasterNoteNavEntry =
  | { kind: 'note'; id: string; name: string }
  | {
      kind: 'entity';
      entityKind: 'npc' | 'item' | 'character' | 'location';
      id: string;
      name: string;
    };

/** Minimal entity payload passed from wiki chips to open dialogs / nav. */
export type MasterNoteLinkedEntity = { id: string; name?: string };
