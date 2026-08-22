import { BaseApiClient } from './base';
import type {
  ObserverRoomPreview,
  ObserverRoomSort,
  ObserverRoomSortOrder,
} from '../types/observer';

export class ObserverApiService extends BaseApiClient {
  private readonly endpoint = '/session-obs';

  async listRooms(params?: {
    search?: string;
    sort?: ObserverRoomSort;
    order?: ObserverRoomSortOrder;
  }): Promise<ObserverRoomPreview[]> {
    return this.get<ObserverRoomPreview[]>(`${this.endpoint}/rooms`, params);
  }

  openWebSocket(code: string): WebSocket {
    const url = `${this.baseURL}${this.endpoint}/ws/${encodeURIComponent(code)}`;
    return new WebSocket(url);
  }
}

export const observerApiService = new ObserverApiService();
