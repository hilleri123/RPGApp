import { BaseApiClient } from './base';
import { Rule, RuleCreate, RuleUpdate } from '../types/rules';
import { EntityType } from '../types2';


export type PluginConfig = any;

export class RulesApiService extends BaseApiClient {
  private readonly endpoint = '/rules';

  async getRules(params?: {
    skip?: number;
    limit?: number;
    search?: string;
  }): Promise<Rule[]> {
    return this.get<Rule[]>(this.endpoint, params);
  }

  async getRule(id: string): Promise<Rule> {
    return this.get<Rule>(`${this.endpoint}/${id}`);
  }

  async createRule(ruleData: RuleCreate): Promise<Rule> {
    return this.post<Rule>(this.endpoint, ruleData);
  }

  async updateRule(id: string, ruleData: RuleUpdate): Promise<Rule> {
    return this.put<Rule>(`${this.endpoint}/${id}`, ruleData);
  }

  async deleteRule(id: string): Promise<void> {
    await this.delete<void>(`${this.endpoint}/${id}`);
  }

  async duplicateRule(id: string, name: string): Promise<Rule> {
    return this.post<Rule>(`${this.endpoint}/${id}/duplicate`, { name });
  }

  async exportRule(id: string): Promise<Blob> {
    const response = await fetch(`${this.baseURL}${this.endpoint}/${id}/export`, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Ошибка экспорта правила');
    }

    return response.blob();
  }

  async importRule(file: File): Promise<Rule> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseURL}${this.endpoint}/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        detail: 'Ошибка импорта' 
      }));
      throw new Error(errorData.detail || 'Ошибка импорта правила');
    }

    return response.json();
  }

  async getCharacterConfig(scenarioId: string, context: Record<string, any> = {}): Promise<PluginConfig> {
    // было: /api/rules/{scenarioId}/character/config
    // endpoint уже с /api внутри BaseApiClient (как у тебя в остальных сервисах)
    return this.post<PluginConfig>(`${this.endpoint}/${scenarioId}/character/config`, context);
  }

  // если ты сделал универсально по типам:
  async getEntityConfig(
    scenarioId: string,
    type: EntityType,
    context: Record<string, any> = {}
  ): Promise<PluginConfig> {
    return this.post<PluginConfig>(`${this.endpoint}/${scenarioId}/${type}/config`, context);
  }
}

export const rulesApiService = new RulesApiService();
