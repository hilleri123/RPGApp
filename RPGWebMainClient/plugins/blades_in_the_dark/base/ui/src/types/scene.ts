export type EntityRef = {
  id: string;
  name: string;
  data: Record<string, any>;
};

export type SceneCharacterRef = EntityRef & {
  owned_items: EntityRef[];          // как в payload: owned_items
  short_desc?: string;
  story?: string;
  icon_url?: string | null;
  img_url?: string | null;
  location_id?: string | null;
};

export type SceneElements = {
  npcs: Array<EntityRef & { owned_items?: EntityRef[] }>; // если у npc есть owned_items, иначе можно убрать
  items: EntityRef[];
};

export type ScenePayload = {
  scene: {
    id: string;
    name: string;
    data: Record<string, any>;
    location: any;                   // можешь типизировать отдельно
    characters: SceneCharacterRef[];
    public: SceneElements;
    private: SceneElements;
    available_actions: any[];
  };

  players: Array<{
    id: string;
    user: { id: string; full_name?: string | null; email?: string | null };
    character_id: string | null;
    name: string;
    color?: string | null;
  }>;

  links: {
    characterToUserId: Record<string, string>; // characterId -> userId
  };
};


export type PluginScene = {
  players: Record<string, { characters: SceneCharacterRef[] }>; // key = userId
  npcs: Array<EntityRef & { owned_items?: EntityRef[] }>;
  items: EntityRef[];
};
