// item.ts

import { TagDef, MasteryRules } from "./common";

export type DamageType = 'piercing' | 'slashing' | 'blunt' | 'fire' | 'cold' | 'electric';

export type ItemType =
  | 'weapon' | 'armor' | 'shield' | 'tool' | 'consumable'
  | 'rune' | 'scroll' | 'clothing' | 'misc';

export type MagicSource = 'none' | 'rune' | 'scroll';

export type DamageSpec = {
  dtype: DamageType;
  base: number; // integer >= 0 (валидируешь на бэке)
  notes: string;
};

type BaseItem = {
  type: ItemType;

  requiredTags: string[];
  keyTags: string[];

  tags: string[];
};

// --- Variants ---

// damage: weapon/shield/rune/scroll
type WithDamage = { damage: DamageSpec[] };
type NoDamage = { damage?: never };

// defense: weapon/shield/armor/clothing
// (на бэке ты ещё не показал поле defense, поэтому оставляю закомментированным каркасом)
// type WithDefense = { defense: number };
// type NoDefense = { defense?: never };

// magic: только rune/scroll
type RuneMagic = { magic: 'rune'; magicPayload: Record<string, any> };
type ScrollMagic = { magic: 'scroll'; magicPayload: Record<string, any> };
type NoMagic = { magic?: never; magicPayload?: never };

// masteryRules: нет у consumable
type WithMastery = { masteryRules: MasteryRules };
type NoMastery = { masteryRules?: never };

// --- Concrete item types ---

export type WeaponItemData =
  BaseItem &
  { type: 'weapon' } &
  WithMastery &
  WithDamage &
  NoMagic;

export type ShieldItemData =
  BaseItem &
  { type: 'shield' } &
  WithMastery &
  WithDamage &
  NoMagic;

export type ArmorItemData =
  BaseItem &
  { type: 'armor' } &
  WithMastery &
  NoDamage &
  NoMagic;

export type ClothingItemData =
  BaseItem &
  { type: 'clothing' } &
  WithMastery &
  NoDamage &
  NoMagic;

export type ToolItemData =
  BaseItem &
  { type: 'tool' } &
  WithMastery &
  NoDamage &
  NoMagic;

export type MiscItemData =
  BaseItem &
  { type: 'misc' } &
  WithMastery &
  NoDamage &
  NoMagic;

export type ConsumableItemData =
  BaseItem &
  { type: 'consumable' } &
  NoMastery &
  NoDamage &
  NoMagic;

export type RuneItemData =
  BaseItem &
  { type: 'rune' } &
  WithMastery &
  WithDamage &
  RuneMagic;

export type ScrollItemData =
  BaseItem &
  { type: 'scroll' } &
  WithMastery &
  WithDamage &
  ScrollMagic;

// Итоговый discriminated union:
export type ItemData =
  | WeaponItemData
  | ShieldItemData
  | ArmorItemData
  | ClothingItemData
  | ToolItemData
  | ConsumableItemData
  | RuneItemData
  | ScrollItemData
  | MiscItemData;

// --- Config ---

export type ItemConfig = {
  itemTypes?: ItemType[];
  damageTypes?: DamageType[];
  magicSources?: MagicSource[];

  // новое
  tagCategories?: Array<'technique' | 'material' | 'tactic'>;
  tagsCatalog?: TagDef[];

  constraints?: {
    magicOnlyFrom?: ItemType[];
    damageOnlyFrom?: ItemType[];
    noMasteryOn?: ItemType[];
  };

  initialData: ItemData;
};