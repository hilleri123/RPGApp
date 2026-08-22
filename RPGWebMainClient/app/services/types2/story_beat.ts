import type { UUID } from './common';
import type { EntityData, Issue, UpsertResult, WithLineage } from './entities';
import { SceneExposure, SceneExposureBase, SceneExposureOut, SceneExposurePreview } from './scene_exposure';

// ----------------- story beat models -----------------

// соответствует StoryBeatBase (бэк, новая)
export interface StoryBeatBase {
  name: string;
  order_num?: number; // default 0

  text_for_master?: string | null;
  text_for_players?: string | null;

  img_url?: string | null;
  parent_story_beat_id?: UUID | null;

  location_ids?: UUID[]; // default []
  npc_ids?: UUID[];      // default []
  tags?: string[];
}

// соответствует StoryBeatOut (бэк, новая)
export interface StoryBeatOut extends StoryBeatBase, WithLineage {
  id: UUID;
  scenario_id: UUID;

  scene_exposures: SceneExposureOut[];
}

// соответствует StoryBeatListOut (бэк; можно оставить как раньше)
export interface StoryBeatList extends StoryBeatBase, WithLineage {
  id: UUID;
  scene_exposures?: SceneExposurePreview[];
}

// ----------------- upsert -----------------

// соответствует StoryBeatUpsertPayload (бэк, новая)
export interface StoryBeatUpsertPayload extends StoryBeatBase {
  force?: boolean; // default false
  data: EntityData;

  scene_exposures?: SceneExposure[]; // default []
}

// соответствует StoryBeatUpsertResult (бэк, новая)
export interface StoryBeatUpsertResult extends UpsertResult {
  story_beat: StoryBeatOut | null;
}
