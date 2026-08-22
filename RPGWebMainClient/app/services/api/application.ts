import { BaseApiClient } from './base';
import {
  Application,
  ApplicationCreatePayload,
  ApplicationListItem,
  ApplicationReview,
  ApplicationUpdatePayload,
  ItemRequest,
  ItemRequestCreatePayload,
  MasterReviewPayload,
} from '../types2';


// ── Игрок ─────────────────────────────────────────────────────────────────────

export class ApplicationApiService extends BaseApiClient {
  private readonly ep = '/applications';

  async getList(params?: { rule_id_str?: string; skip?: number; limit?: number }): Promise<ApplicationListItem[]> {
    return this.get<ApplicationListItem[]>(this.ep, params);
  }

  async getById(id: string): Promise<Application> {
    return this.get<Application>(`${this.ep}/${id}`);
  }

  async create(payload: ApplicationCreatePayload): Promise<Application> {
    return this.post<Application>(this.ep, payload);
  }

  async update(
    id: string,
    payload: ApplicationUpdatePayload,
    iconFile?: File,
    imgFile?: File,
  ): Promise<Application> {
    const form = new FormData();
    form.append('data', JSON.stringify(payload));
    if (iconFile) form.append('icon_file', iconFile);
    if (imgFile)  form.append('img_file', imgFile);
    return this.putMultipart<Application>(`${this.ep}/${id}`, form);
  }

  async submit(id: string): Promise<Application> {
    return this.post<Application>(`${this.ep}/${id}/submit`);
  }

  async withdraw(id: string): Promise<Application> {
    return this.post<Application>(`${this.ep}/${id}/withdraw`);
  }

  async remove(id: string): Promise<void> {
    return this.delete<void>(`${this.ep}/${id}`);
  }

  async addReview(id: string, comment: string): Promise<ApplicationReview> {
    return this.post<ApplicationReview>(`${this.ep}/${id}/reviews`, { comment });
  }

  async createItemRequest(appId: string, payload: ItemRequestCreatePayload): Promise<ItemRequest> {
    return this.post<ItemRequest>(`${this.ep}/${appId}/item-requests`, payload);
  }

  async updateItemRequest(
    appId: string,
    reqId: string,
    payload: Partial<ItemRequestCreatePayload>,
  ): Promise<ItemRequest> {
    return this.put<ItemRequest>(`${this.ep}/${appId}/item-requests/${reqId}`, payload);
  }

  async removeItemRequest(appId: string, reqId: string): Promise<void> {
    return this.delete<void>(`${this.ep}/${appId}/item-requests/${reqId}`);
  }

  async validate(payload: {
    rule_id_str: string;
    name: string;
    data?: Record<string, unknown>;
    tags?: string[];
  }): Promise<{ ok: boolean; issues: any[]; data?: Record<string, unknown> }> {
    return this.post('/applications/validate', payload);
  }

  // ── Конфиг редактора правил (тот же формат что api.getEditorConfig в сценарии) ─
  async getRuleEditorConfig(ruleIdStr: string, kind: string): Promise<any> {
    return this.get(`/rules/${ruleIdStr}/editor-config/${kind}`);
  }

  async getRuleSchema(ruleIdStr: string, entity: string, etag?: string) {
    const headers: Record<string, string> = {};
    if (etag) headers['If-None-Match'] = etag;

    const url = `${this.baseURL}/rules/${ruleIdStr}/schema/${entity}`;
    const response = await fetch(url, { method: 'GET', headers, credentials: 'include' });

    if (response.status === 304) {
      return { schema: null as any, etag, notModified: true };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Schema load failed' }));
      throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
    }

    const schema = await response.json();
    return {
      schema,
      etag: response.headers.get('etag') ?? undefined,
      notModified: false,
    };
  }

  async getRuleInit(ruleIdStr: string, entity: string, context: Record<string, any> = {}): Promise<any> {
    return this.post(`/rules/${ruleIdStr}/init/${entity}`, context);
  }

  async getRuleOptions(ruleIdStr: string, entity: string, context: Record<string, any> = {}): Promise<any> {
    return this.post(`/rules/${ruleIdStr}/options/${entity}`, context);
  }

}

export const applicationApiService = new ApplicationApiService();


// ── Мастер ────────────────────────────────────────────────────────────────────

export class MasterApplicationApiService extends BaseApiClient {
  private readonly ep = '/master/applications';

  async getList(params?: {
    status?: string;
    rule_id_str?: string;
    user_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<ApplicationListItem[]> {
    return this.get<ApplicationListItem[]>(this.ep, params);
  }

  async getById(id: string): Promise<Application> {
    return this.get<Application>(`${this.ep}/${id}`);
  }

  async review(id: string, payload: MasterReviewPayload): Promise<Application> {
    return this.post<Application>(`${this.ep}/${id}/review`, payload);
  }

  async decideItemRequest(
    appId: string,
    reqId: string,
    status: 'approved' | 'rejected' | 'modified',
    masterComment?: string,
  ): Promise<ItemRequest> {
    return this.post<ItemRequest>(
      `${this.ep}/${appId}/decide-item-request/${reqId}`,
      { status, master_comment: masterComment },
    );
  }

  async approveAndCreate(id: string): Promise<Application> {
    return this.post<Application>(`${this.ep}/${id}/approve-and-create`);
  }

  async availableCharacters(lobbyId: string): Promise<ApplicationListItem[]> {
    return this.get<ApplicationListItem[]>(`/lobbies/${lobbyId}/available-characters`);
  }

  async finishSession(
    lobbyId: string,
    updates: Array<{
      application_id: string;
      data?: Record<string, unknown>;
      story_append?: string;
      tags_add?: string[];
    }>,
  ): Promise<{ ok: boolean; updated: number }> {
    return this.post<{ ok: boolean; updated: number }>(
      `/lobbies/${lobbyId}/finish-session`,
      { character_updates: updates },
    );
  }


  async update(
    id: string,
    payload: ApplicationUpdatePayload,
    iconFile?: File,
    imgFile?: File,
  ): Promise<Application> {
    const form = new FormData();
    form.append('data', JSON.stringify(payload));
    if (iconFile) form.append('icon_file', iconFile);
    if (imgFile)  form.append('img_file', imgFile);
    return this.putMultipart<Application>(`${this.ep}/${id}`, form);
  }


  async validate(payload: {
    rule_id_str: string;
    name: string;
    data?: Record<string, unknown>;
    tags?: string[];
  }): Promise<{ ok: boolean; issues: any[]; data?: Record<string, unknown> }> {
    return this.post('/applications/validate', payload);
  }
}

export const masterApplicationApiService = new MasterApplicationApiService();
