import { BaseApiClient } from './base';
import {
  Campaign,
  CampaignCreate,
  CampaignUpdate,
  SessionFinishResponse,
} from '../types/campaign';

export class CampaignsApiService extends BaseApiClient {
  private readonly endpoint = '/campaigns';

  async listCampaigns(): Promise<Campaign[]> {
    return this.get<Campaign[]>(this.endpoint);
  }

  async getCampaign(id: string): Promise<Campaign> {
    return this.get<Campaign>(`${this.endpoint}/${id}`);
  }

  async createCampaign(data: CampaignCreate): Promise<Campaign> {
    return this.post<Campaign>(this.endpoint, data);
  }

  async updateCampaign(id: string, data: CampaignUpdate): Promise<Campaign> {
    return this.patch<Campaign>(`${this.endpoint}/${id}`, data);
  }

  async deleteCampaign(id: string): Promise<void> {
    return this.delete<void>(`${this.endpoint}/${id}`);
  }

  async startCampaignSession(
    id: string,
    data: { lobby_id?: string; step_index?: number },
  ): Promise<{ session_id: string }> {
    return this.post<{ session_id: string }>(`${this.endpoint}/${id}/start-session`, data);
  }

  async continueCampaign(id: string): Promise<{ session_id: string }> {
    return this.post<{ session_id: string }>(`${this.endpoint}/${id}/continue`);
  }

  async getProfile(): Promise<import('../types/sessionDispatch').CampaignProfile> {
    return this.get(`${this.endpoint}/profile/me`);
  }
}

export const campaignsApiService = new CampaignsApiService();
