export interface LaunchedScenario {
  id: string;
  name: string;
  source_scenario_id?: string | null;
  lifecycle_status?: 'running' | 'closed' | null;
  launch_mode?: 'single_party' | 'multi_party' | null;
  created?: string;
  active_approach_session_id?: string | null;
}

export interface ScenarioParty {
  id: string;
  launched_scenario_id: string;
  name: string;
  filter_tags: string[];
  sort_order: number;
}
