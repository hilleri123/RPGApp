import { RoleAccess } from "../types/access_groups";
import { User } from "../types/auth";

export interface ScenarioBase {
  name: string;
  intro?: string;
  max_players?: number;
  rule_id_str?: string;
  user_id?: string;
  icon?: string;
  created_at?: string;
  updated_at?: string;

  scenario_starts_at?: string;

  is_session_snapshot?: boolean;
  source_scenario_id?: string | null;

  user?: User;
}

export interface Scenario extends ScenarioBase {
  id: string;
  permission?: RoleAccess;
}

export interface ScenarioCreate extends ScenarioBase {}

export interface ScenarioUpdate extends Partial<ScenarioCreate> {}


export type ScenarioCounts = {
  story_beats: number;
  locations: number;
  characters: number;
  npcs: number;
  items: number;
  notes: number;
  counters: number;
};

export type ScenarioWithCounts = Scenario & {
  counts: ScenarioCounts;
  template_set_id: string;
  linked_template_set_ids: string[];
  linked_name_pack_ids?: string[];
};