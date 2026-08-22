import { BaseApiClient } from './base';
import type { TemplateEntityBrowseItem, TemplateEntityKind } from '../types2/template_entity';

export type EntityPack = {
  id: string;
  rule_id_str: string;
  name: string;
  tags: string[];
};

export type EntityPackUpdate = {
  name?: string;
  tags?: string[];
};

export class EntityPacksApiService extends BaseApiClient {
  getPack(packId: string): Promise<EntityPack> {
    return this.get<EntityPack>(`/entity_packs/${packId}`);
  }

  updatePack(packId: string, body: EntityPackUpdate): Promise<EntityPack> {
    return this.patch<EntityPack>(`/entity_packs/${packId}`, body);
  }

  listForRule(ruleIdStr: string): Promise<EntityPack[]> {
    return this.get<EntityPack[]>(`/rules/${encodeURIComponent(ruleIdStr)}/entity_packs`);
  }

  createPack(ruleIdStr: string, name: string): Promise<EntityPack> {
    return this.post<EntityPack>(`/rules/${encodeURIComponent(ruleIdStr)}/entity_packs`, {
      name,
      rule_id_str: ruleIdStr,
    });
  }

  linkPackToScenario(scenarioId: string, packId: string): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/scenarios/${scenarioId}/template_sets/${packId}`);
  }

  unlinkPackFromScenario(scenarioId: string, packId: string): Promise<{ ok: boolean }> {
    return this.delete<{ ok: boolean }>(`/scenarios/${scenarioId}/template_sets/${packId}`);
  }

  linkTemplateEntity(
    scenarioId: string,
    body: { entity_kind: string; entity_id: string; enabled?: boolean; order_num?: number }
  ): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/scenarios/${scenarioId}/template_entities`, body);
  }

  unlinkTemplateEntity(
    scenarioId: string,
    entityKind: string,
    entityId: string
  ): Promise<{ ok: boolean }> {
    return this.delete<{ ok: boolean }>(
      `/scenarios/${scenarioId}/template_entities/${entityKind}/${entityId}`
    );
  }

  browseTemplatesForScenario(
    scenarioId: string,
    entityKind: TemplateEntityKind,
    params?: { search?: string; skip?: number; limit?: number }
  ): Promise<TemplateEntityBrowseItem[]> {
    return this.get<TemplateEntityBrowseItem[]>(
      `/scenarios/${scenarioId}/browse_template_entities/${entityKind}`,
      params
    );
  }

  browseTemplatesForRule(
    ruleIdStr: string,
    entityKind: TemplateEntityKind,
    params?: { search?: string; skip?: number; limit?: number }
  ): Promise<TemplateEntityBrowseItem[]> {
    return this.get<TemplateEntityBrowseItem[]>(
      `/rules/${encodeURIComponent(ruleIdStr)}/template_entities/${entityKind}`,
      params
    );
  }

  browseTemplatesForPack(
    packId: string,
    entityKind: TemplateEntityKind,
    params?: { search?: string; skip?: number; limit?: number }
  ): Promise<TemplateEntityBrowseItem[]> {
    return this.get<TemplateEntityBrowseItem[]>(
      `/entity_packs/${packId}/browse_template_entities/${entityKind}`,
      params
    );
  }

  addPackMember(
    packId: string,
    body: { entity_kind: string; entity_id: string }
  ): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/entity_packs/${packId}/members`, body);
  }
}

export const entityPacksApiService = new EntityPacksApiService();
