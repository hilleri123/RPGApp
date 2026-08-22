import { BaseApiClient } from './base';
import { LaunchedScenario, ScenarioParty } from '../types/launchedScenario';
import { Scenario } from '../types2';

export interface LaunchedScenarioDetail {
  launched: LaunchedScenario;
  prep_scenario: Scenario | null;
}

export interface EntityLineage {
  entity_type: string;
  prep_scenario_id?: string | null;
  prep_scenario_name?: string | null;
  launched_scenario_id?: string | null;
  current_scenario_id: string;
  current_entity_id: string;
  current: Record<string, unknown>;
  prep?: Record<string, unknown> | null;
  prep_entity_id?: string | null;
  has_prep_entity: boolean;
}

export class LaunchedScenariosApiService extends BaseApiClient {
  private readonly endpoint = '/launched-scenarios';

  async list(): Promise<LaunchedScenario[]> {
    return this.get<LaunchedScenario[]>(this.endpoint);
  }

  async getDetail(id: string): Promise<LaunchedScenarioDetail> {
    return this.get<LaunchedScenarioDetail>(`${this.endpoint}/${id}`);
  }

  async listParties(launchedId: string): Promise<ScenarioParty[]> {
    return this.get<ScenarioParty[]>(`${this.endpoint}/${launchedId}/parties`);
  }

  async close(launchedId: string): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`${this.endpoint}/${launchedId}/close`, {});
  }

  async createParty(
    launchedId: string,
    data: { name: string; filter_tags: string[]; sort_order?: number },
  ): Promise<ScenarioParty> {
    return this.post<ScenarioParty>(`${this.endpoint}/${launchedId}/parties`, data);
  }

  async getEntityLineage(
    scenarioId: string,
    entityType: string,
    entityId: string,
  ): Promise<EntityLineage> {
    return this.get<EntityLineage>(
      `/scenarios/${scenarioId}/entity-lineage/${entityType}/${entityId}`,
    );
  }

  async syncEntityLineage(
    scenarioId: string,
    payload: { entity_type: string; entity_id: string; direction: 'to_prep' | 'to_launched' },
  ): Promise<EntityLineage> {
    return this.post<EntityLineage>(`/scenarios/${scenarioId}/entity-lineage/sync`, payload);
  }

  async patchEntityLineage(
    scenarioId: string,
    payload: {
      entity_type: string;
      entity_id: string;
      side: 'current' | 'prep';
      fields: Record<string, string>;
    },
  ): Promise<EntityLineage> {
    return this.post<EntityLineage>(`/scenarios/${scenarioId}/entity-lineage/patch`, payload);
  }

  async ensurePrepEntity(
    scenarioId: string,
    entityType: string,
    entityId: string,
  ): Promise<EntityLineage> {
    return this.post<EntityLineage>(
      `/scenarios/${scenarioId}/entity-lineage/${entityType}/${entityId}/ensure-prep`,
      {},
    );
  }
}

export const launchedScenariosApi = new LaunchedScenariosApiService();
