import { BaseApiClient } from './base';
import { GameSessionPreview } from '../types/session';
import { SessionFinishResponse } from '../types/campaign';

export class SessionApiService extends BaseApiClient {
  private readonly endpoint = '/session';

  async getSessions(params?: {
    skip?: number;
    limit?: number;
    search?: string;
  }): Promise<GameSessionPreview[]> {
    return this.get<GameSessionPreview[]>(this.endpoint, params);
  }

  async closeSession(session_id: string, forced: boolean = false): Promise<SessionFinishResponse> {
    return this.post<SessionFinishResponse>(`${this.endpoint}/${session_id}/finish`, { forced });
  }

  openWebSocket(sessionId: string): WebSocket {
    const url = `${this.baseURL}${this.endpoint}/ws/${sessionId}`;
    return new WebSocket(url);
  }
}

export const sessionApiService = new SessionApiService();
