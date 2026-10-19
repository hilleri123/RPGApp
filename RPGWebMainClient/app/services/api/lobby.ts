import { BaseApiClient } from './base';
import { Lobby, LobbyCreate, LobbyPreview, LobbyUserHit } from '../types/lobby';
import type { Application } from '../types2';

export class LobbyApiService extends BaseApiClient {
  private readonly endpoint = '/lobby';

  async getLobbies(params?: {
    skip?: number;
    limit?: number;
    search?: string;
  }): Promise<LobbyPreview[]> {
    return this.get<LobbyPreview[]>(this.endpoint, params);
  }

  async getLobby(id: string): Promise<Lobby> {
    return this.get<Lobby>(`${this.endpoint}/${id}`);
  }

  async createLobby(lobbyData: LobbyCreate): Promise<Lobby> {
    return this.post<Lobby>(this.endpoint, lobbyData);
  }

  async deleteLobby(id: string): Promise<{ status: string }> {
    return this.delete<{ status: string }>(`${this.endpoint}/${id}`);
  }

  /** Поиск игроков для приглашения (только мастер лобби). */
  async searchUsersToInvite(lobbyId: string, q: string): Promise<LobbyUserHit[]> {
    return this.get<LobbyUserHit[]>(`${this.endpoint}/${lobbyId}/user_search`, { q });
  }

  /** Черновик заявки под сценарий лобби. Мастер передаёт user_id игрока. */
  async openCharacterApplication(
    lobbyId: string,
    body?: { user_id?: string; reviewer_id?: string },
  ): Promise<Application> {
    return this.post<Application>(`${this.endpoint}/${lobbyId}/character_application`, body ?? {});
  }

  openWebSocket(lobbyId: string): WebSocket {
    const url = `${this.baseURL}${this.endpoint}/ws/${lobbyId}`;
    return new WebSocket(url);
  }
}

export const lobbyApiService = new LobbyApiService();
