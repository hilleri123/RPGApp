// character.ts
import type { PassiveDef, PassiveState, TagDef, Economy } from './common';

// В бэке Trait — отдельная модель; в твоём UI meta встречается,
// поэтому оставляем meta, но делаем id обязательным (в бэке ты его нормализуешь/требуешь по смыслу).
export type Trait = {
  id: string;
  text: string;
  meta: Record<string, any>;
};

// В бэке Tracks/TrackMax: NonNegativeInt по каждому ключу,
// т.е. число >= 0 (на фронте просто number, но ожидаем неотрицательные).
export type Tracks = {
  hp: number;
  eq: number;
  fat: number;
  conc: number;
  grudge: number;
};

export type TrackMax = Tracks;

// Бэкенд: CombatantKind = "pc" | "npc"
export type CharacterKind = 'pc' | 'npc';

// Это соответствует CombatantData (а CharacterData на бэке = CombatantData).
export type CharacterData = {
  kind: CharacterKind;

  // выбранные тэги
  tags: string[];

  // список Trait (объекты, не ids)
  traits: Trait[];

  tracks: Tracks;
  trackMax: TrackMax;

  // economy: dict[str,int] с ключами main/move/defense
  economy: Economy;

  // items/passives: списки
  items: string[];
  passives: PassiveState[];

  // derived у тебя добавляется менеджером (data.setdefault("derived", {}))
  // поэтому на фронте держим опциональным.
  derived?: Record<string, any>;
};

export type CharacterConfig = {
  tagCategories: Array<'technique' | 'material' | 'tactic'>;
  tagsCatalog: TagDef[];

  // На бэке сейчас может быть пустым; но поле в config() всегда есть.
  passivesCatalog: PassiveDef[];

  // (опционально) если ты добавил traitsCatalog в config менеджера — лучше отразить и тут
  traitsCatalog?: Trait[];

  constraints?: {
    traitsAtStart?: number;
    tagCountAtStart?: number;
    categoryLimitsAtStart?: Record<string, number>;
    economyDefaults?: Economy;
  };

  initialData: CharacterData;
};
