import { BaseApiClient } from './base';

export type PreparedSeed = {
  id: string;
  position: number;
  image: string;
  created_at?: string | null;
};

class PreparedSeedsApi extends BaseApiClient {
  list(sessionId: string): Promise<PreparedSeed[]> {
    return this.get<PreparedSeed[]>(`/sessions/${sessionId}/prepared-seeds`);
  }

  add(sessionId: string, image: string): Promise<PreparedSeed> {
    return this.post<PreparedSeed>(`/sessions/${sessionId}/prepared-seeds`, { image });
  }

  remove(sessionId: string, seedId: string): Promise<{ ok: boolean }> {
    return this.delete<{ ok: boolean }>(`/sessions/${sessionId}/prepared-seeds/${seedId}`);
  }

  reorder(sessionId: string, ids: string[]): Promise<PreparedSeed[]> {
    return this.put<PreparedSeed[]>(`/sessions/${sessionId}/prepared-seeds/reorder`, { ids });
  }
}

export const preparedSeedsApi = new PreparedSeedsApi();
