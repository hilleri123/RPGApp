export type WeaponType = 'melee' | 'ranged';
export type ArmorVs = 'melee' | 'ranged' | 'all';

export type ItemWeapon = {
  type: WeaponType;
  damage: string; 
};

export type ItemArmor = {
  rating: number;
  vs: ArmorVs[];
};

export type ItemData = {
  tags: string[];

  weapon?: ItemWeapon | null;
  armor?: ItemArmor | null;
};

export type ItemConfig = {
  tags: string[];
  initialData: ItemData;
};
