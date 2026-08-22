// types2.ts

import type { PlayerCharacter } from './character'; // или скорректируй путь, если нужно
import { GameItem } from './item';
import { NPC } from './npc';

export type FactoryCharacter = PlayerCharacter & {
  // В InnerCharacter есть player?: Player | null,
  // но в фабрике он всегда null
  // player: null;
  // location_id обычно null, но тип можно не менять
};

export type FactoryNPC = NPC & {
  // в фабрике location_id, owner и т.п. обычно null
};

export type FactoryItem = GameItem & {
  // владелец и локация отсутствуют
  owner_id?: string | null;
  location_id?: string | null;
};

export type Factory = {
  characters: FactoryCharacter[];
  npcs: FactoryNPC[];
  items: FactoryItem[];
};

// Если тебе нужен «набор фабрик» как на бэке RuleTemplateSet:
export type FactorySet = {
  id: string;
  rule_id_str: string | null;
  name: string;
  scenario_id: string;
  factory: Factory;
};
