import { BaseApiClient } from './base';
import { Scenario, ScenarioWithCounts, ScenarioCreate, ScenarioUpdate, RuleSystemInfo } from '../types2';

export class ScenariosApiService extends BaseApiClient {
  private readonly endpoint = '/scenarios';
  private readonly ruleSystemsEndpoint = '/rulesystems';

  async getScenarios(params?: {
    rule_id_str?: string;
    rules_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<Scenario[]> {
    const query = { ...params };
    if (query.rules_id && !query.rule_id_str) {
      query.rule_id_str = query.rules_id;
    }
    delete query.rules_id;
    return this.get<Scenario[]>(this.endpoint, query);
  }

  async getScenario(id: string): Promise<ScenarioWithCounts> {
    return this.get<ScenarioWithCounts>(`${this.endpoint}/${id}`);
  }

  async createScenario(data: ScenarioCreate, file?: File): Promise<Scenario> {
    const scenario = this.post<Scenario>(this.endpoint, data)
    if (!file)
      return scenario;

    return this.setIconToScenario((await scenario).id, file);
  }

  async setIconToScenario(scenarioId: string, file: File): Promise<Scenario> {
    return this.request<Scenario>(`${this.endpoint}/${scenarioId}/icon`, {
      method: 'POST',
      body: file,
      headers: {
        'Content-Type': 'image/x-icon',
      },
    });
  }

  async updateScenario(id: string, data: ScenarioUpdate, file?: File): Promise<Scenario> {
    const formData = new FormData();

    if (data.name !== undefined) formData.append('name', data.name);
    if (data.intro !== undefined) formData.append('intro', data.intro ?? '');
    if (data.max_players !== undefined && data.max_players !== null) {
      formData.append('max_players', String(data.max_players));
    }
    if (data.rule_id_str !== undefined) {
      formData.append('rule_id_str', data.rule_id_str ?? '');
    }
    if (data.scenario_starts_at !== undefined) {
      formData.append('scenario_starts_at', data.scenario_starts_at ?? '');
    }
    if (file) formData.append('icon', file);

    return this.request<Scenario>(
      `${this.endpoint}/${id}`, 
      {
        method: 'PUT',
        body: formData,
      },
      false,
    );
  }

  async deleteScenario(id: string): Promise<void> {
    return this.delete<void>(`${this.endpoint}/${id}`);
  }

  async duplicateScenario(id: string, name?: string): Promise<Scenario> {
    return this.post<Scenario>(`${this.endpoint}/${id}/duplicate`, { name: name ?? null });
  }


  async getRuleSystems(): Promise<RuleSystemInfo[]> {
    return this.get<RuleSystemInfo[]>(this.ruleSystemsEndpoint);
  }

  async reloadRuleSystems(): Promise<{ ok: boolean; count: number }> {
    return this.post<{ ok: boolean; count: number }>(`${this.ruleSystemsEndpoint}/reload`, {});
  }

  async downloadScenarioPdf(id: string, includeMaster: boolean = true): Promise<void> {
    const { blob, filename } = await this.download(
      `${this.endpoint}/${id}/export/pdf`,
      { include_master: includeMaster },
    );

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }

  async downloadScenarioArchive(id: string): Promise<void> {
    const { blob, filename } = await this.download(
      `${this.endpoint}/${id}/export/archive`,
    );

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }

  async importScenarioArchive(file: File): Promise<{
    imported: boolean;
    reason?: string | null;
    id?: string | null;
    created: Record<string, number>;
    skipped: Record<string, number>;
    warnings: string[];
  }> {
    const form = new FormData();
    form.append('file', file);
    return this.postMultipart(`${this.endpoint}/import/archive`, form);
  }

}

export const scenariosApiService = new ScenariosApiService();
