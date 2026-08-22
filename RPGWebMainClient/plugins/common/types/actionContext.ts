export type UUID = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = Record<string, JsonValue>;

export type ActionStatus = 'active' | 'completed' | 'cancelled' | string;

export interface Workflow {
  actionKey: string;
  stageKey: string;
  stageData?: Record<string, unknown>;
  context?: Record<string, unknown>;
  status?: ActionStatus;
  tags?: string[];
}

export interface ActionParticipants {
  gmUserId: UUID;
  initiatorUserId: UUID;
  participants: UUID[];
  placeholders?: Record<string, unknown>;
}

export interface ItemContext {
  id: UUID;
  name: string;
  equipped?: boolean;
  tags?: string[] | null;
  data: JsonObject;
  icon_url?: string | null;
  img_url?: string | null;
  [key: string]: JsonValue | undefined;
}

export interface CharacterContext {
  id: UUID;
  name: string;
  short_desc?: string | null;
  story?: string | null;
  icon_url?: string | null;
  img_url?: string | null;
  tags?: string[] | null;
  data: JsonObject;
  items: ItemContext[];
  [key: string]: JsonValue | undefined;
}

export interface NPCContext {
  id: UUID;
  name: string;
  description_for_master?: string | null;
  description_for_players?: string | null;
  icon_url?: string | null;
  img_url?: string | null;
  tags?: string[] | null;
  data: JsonObject;
  items: ItemContext[];
  [key: string]: JsonValue | undefined;
}

export interface ObstacleContext {
  id: UUID;
  name: string;
  tags?: string[] | null;
  data: JsonObject;
  [key: string]: JsonValue | undefined;
}

export interface LocationContext {
  id: UUID;
  name: string;
  tags?: string[] | null;
  data: JsonObject;
  map_url?: string | null;
  [key: string]: JsonValue | undefined;
}

export interface SceneContext {
  id: UUID;
  name: string;
  location?: LocationContext | null;
  characters: CharacterContext[];
  npcs: NPCContext[];
  items: ItemContext[];
  obstacles: ObstacleContext[];
  data: JsonObject;
}

export interface Links {
  characterToUserId: Record<UUID, UUID>;
}

export interface User {
  id: UUID;
  full_name?: string | null;
  img_url?: string | null;
}

export interface Player {
  id: UUID;
  user: User;
}

export interface ScenePayload {
  scene: SceneContext;
  players: Player[];
  links: Links;
}

export interface ActionContext extends ScenePayload {
  actionKey: string;
  actorUserId: UUID;
  can_close: boolean;
  participants: ActionParticipants;
  workflow?: Workflow | null;
  input?: Record<string, unknown> | null;
}
