import { BaseApiClient } from './base';

export type LibraryLocation = {
  id: string;
  name: string;
  kind: string | null;
  tags: string[];
  is_template: boolean;
  scenario_id: string;
  scenario_name: string;
  parent_location_name: string | null;
  children_count: number;
  icon_url: string | null;
  map_url: string | null;
  snippet: string;
};

export type LibrarySearchParams = {
  q?: string;
  kinds?: string[];
  tags?: string[];
  scenarioId?: string;
  templatesOnly?: boolean;
  ruleIdStr?: string;
  limit?: number;
};

export type ImportLocationResult = { location_id: string; created_ids: string[] };

export class LocationLibraryApiService extends BaseApiClient {
  async search(p: LibrarySearchParams = {}): Promise<LibraryLocation[]> {
    const qs = new URLSearchParams();
    if (p.q?.trim()) qs.set('q', p.q.trim());
    if (p.kinds?.length) qs.set('kinds', p.kinds.join(','));
    if (p.tags?.length) qs.set('tags', p.tags.join(','));
    if (p.scenarioId) qs.set('scenario_id', p.scenarioId);
    if (p.templatesOnly) qs.set('templates_only', 'true');
    if (p.ruleIdStr) qs.set('rule_id_str', p.ruleIdStr);
    if (p.limit) qs.set('limit', String(p.limit));
    const suffix = qs.toString();
    return this.get<LibraryLocation[]>(`/location_library${suffix ? `?${suffix}` : ''}`);
  }

  /** Клонирует локацию (с подлокациями) в сценарий или снимок сессии. */
  async importInto(
    targetScenarioId: string,
    data: { sourceLocationId: string; includeChildren?: boolean; parentLocationId?: string | null },
  ): Promise<ImportLocationResult> {
    return this.post<ImportLocationResult>(`/scenarios/${targetScenarioId}/locations/import`, {
      source_location_id: data.sourceLocationId,
      include_children: data.includeChildren ?? true,
      parent_location_id: data.parentLocationId ?? null,
    });
  }
}

export const locationLibraryApi = new LocationLibraryApiService();
