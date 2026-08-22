import type { UUID } from "./common";
import { GameItemWithOwnerShort } from "./item";
import { NPCList } from "./npc";
import { ObstacleOutInline, ObstacleUpsertInline } from "./obstacle";
import { ExposureAudioLink } from "../types/audio";

// ----------------- scene exposure (embedded) -----------------

export interface TemplateNPCLink {
  template_npc: NPCList;
  qty: number;
}

export interface TemplateItemLink {
  template_item: GameItemWithOwnerShort;
  qty: number;
}

// соответствует StoryBeatSceneExposureBase (бэк, новая)
export interface SceneExposureBase {
  id?: UUID | null;       // upsert
  name: string;
  order_num?: number;
  tags?: string[];
}

export interface TemplateNPCLinkPayload {
  id: UUID;
  qty: number;
}


export interface SceneExposure extends SceneExposureBase {
  npc_ids?: UUID[];       // default []
  item_ids?: UUID[];      // default []
  template_npc_ids?: TemplateNPCLinkPayload[];   // было UUID[]
  template_item_ids?: TemplateNPCLinkPayload[];  // было UUID[]
  audio_ids?: UUID[];

  obstacles?: ObstacleUpsertInline[]; // default []
}

// соответствует StoryBeatSceneExposureOut (бэк, новая)
export interface SceneExposureOut extends SceneExposureBase {
  id: UUID;
  npcs: NPCList[];
  items: GameItemWithOwnerShort[];
  template_npc_links: TemplateNPCLink[];   // было template_npcs
  template_item_links: TemplateItemLink[]; // было template_items
  audio_tracks: ExposureAudioLink[];
  
  obstacles: ObstacleOutInline[];
}

/** Compact exposure summary for entity list cards. */
export interface SceneExposurePreview {
  id: UUID;
  name: string;
  order_num?: number;
  tags?: string[];
  npc_normal: number;
  npc_enemy: number;
  npc_dead: number;
  npc_enemy_dead: number;
  template_npc_normal?: number;
  template_npc_enemy?: number;
  template_npc_dead?: number;
  template_npc_enemy_dead?: number;
  template_npc_qty: number;
  item_count: number;
  template_item_qty: number;
  obstacle_count: number;
  audio_count: number;
}
