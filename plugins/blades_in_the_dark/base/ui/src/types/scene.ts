export type EntityRef = { id: string; name: string; data: Record<string, any> };
export type SceneCharacterRef = EntityRef & { items: EntityRef[] };

export type PluginScene = {
  players: Record<string, { characters: SceneCharacterRef[] }>; // key=userId
  npc: Array<EntityRef & { items: EntityRef[] }>;
  items: EntityRef[];
};
