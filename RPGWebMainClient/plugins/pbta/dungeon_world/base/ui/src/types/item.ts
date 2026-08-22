// TagMeta — только для отображения (приходит с бэка в config.tags)
export type TagMeta = {
  id:      string;
  label:   string;
  hint?:   string;
  effect?: string;
};

// Derived-поля оружия (приходят в data.derived.weapon)
export type DerivedWeapon = {
  damage_dice:     string | null;  // null = куб класса
  damage_bonus:    number;
  piercing:        number;
  use_dex:         boolean;        // precise
  forceful:        boolean;
  ignores_armor:   boolean;
  requires_reload: boolean;
  range:           RangeTag[];
};

// Derived-поля брони (приходят в data.derived.armor)
export type DerivedArmor = {
  armor_value:     number;
  stacks:          boolean;
  ongoing_penalty: number;         // -1 если clumsy
  is_shield:       boolean;
};

export type ItemDerived = {
  weapon?: DerivedWeapon;
  armor?:  DerivedArmor;
  weight:  number;
};

// ItemData — то, что хранится в БД и редактируется (без derived)
export type RangeTag          = 'hand' | 'close' | 'reach' | 'near' | 'far';
export type WeaponMechanicTag = 'two-handed' | 'forceful' | 'precise' | 'reload' | 'thrown' | 'messy' | 'ignores-armor';
export type ArmorMechanicTag  = 'worn' | 'clumsy' | 'shield';

export type DamageBonus = { bonus: number };
export type PiercingTag = { value: number };
export type AmmoTag     = { value: number };
export type ArmorValue  = { value: number; stacks: boolean };

export type ItemWeapon = {
  range_tags:     RangeTag[];
  mechanic_tags:  WeaponMechanicTag[];
  damage_dice?:   string | null;
  damage_bonus?:  DamageBonus | null;
  piercing?:      PiercingTag | null;
  ammo?:          AmmoTag | null;
};

export type ItemArmor = {
  armor?:         ArmorValue | null;
  mechanic_tags:  ArmorMechanicTag[];
};

export type ItemData = {
  general_tags: string[];
  weight:       number;
  cost?:        number | null;
  weapon?:      ItemWeapon | null;
  armor?:       ItemArmor | null;
  derived?:     ItemDerived;        // только чтение, не редактируется
};

// Config (приходит с бэка)
export type ItemTagsConfig = {
  range:           TagMeta[];
  weapon_mechanic: TagMeta[];
  armor_mechanic:  TagMeta[];
  general:         TagMeta[];
};

export type ItemConfig = {
  initialData: Omit<ItemData, 'derived'>;
  tags:        ItemTagsConfig;
};