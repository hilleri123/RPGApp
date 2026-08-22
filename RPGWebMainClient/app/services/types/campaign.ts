export interface CampaignScenarioLink {
  scenario_id: string;
  order_num: number;
  title_override?: string | null;
}

export interface CampaignScenarioOut extends CampaignScenarioLink {
  id: string;
  scenario_name?: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string | null;
  master_id: string;
  rule_id_str?: string | null;
  current_step_index: number;
  is_active: boolean;
  scenarios: CampaignScenarioOut[];
  has_carryover: boolean;
  can_continue: boolean;
  prep_scenario_id?: string | null;
  launched_scenario_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CampaignCreate {
  name: string;
  description?: string | null;
  rule_id_str?: string | null;
  scenarios: CampaignScenarioLink[];
}

export interface CampaignUpdate {
  name?: string;
  description?: string | null;
  rule_id_str?: string | null;
  scenarios?: CampaignScenarioLink[];
  current_step_index?: number;
  is_active?: boolean;
}

export interface CampaignSessionFinish {
  ok: boolean;
  campaign_id?: string | null;
  finished_step_index?: number | null;
  next_step_index?: number | null;
  has_next: boolean;
  carryover_saved: boolean;
}

export interface SessionFinishResponse {
  status: string;
  forced: boolean;
  campaign?: CampaignSessionFinish;
}
