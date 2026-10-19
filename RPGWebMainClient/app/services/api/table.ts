import { BaseApiClient } from './base';

export type TableUtterance = {
  id: string;
  participant_id: string | null;
  text: string;
  confidence: number | null;
  real_started_at: string;
  real_ended_at: string;
  game_time: string | null;
  provider: string;
};

export type TableParticipant = {
  id: string;
  jitsi_id: string;
  display_name: string;
  character_id: string | null;
  bind_kind?: '' | 'character' | 'master' | 'observer';
  observer_code?: string | null;
  bind_label?: string;
};

export type TableRecap = {
  id: string;
  text: string;
  images: { paragraph?: string; prompt?: string; url?: string | null; error?: string | null }[];
  created_at?: string;
};

export type TableSpeaker = {
  participant_id: string;
  display_name: string;
  bytes: number;
  seconds: number;
};

export type LobbyTable = {
  room_url: string;
  music_enabled: boolean;
  auto_connect: boolean;
  has_password: boolean;
  table: TableState | null;
};

export type TableState = {
  id: string;
  created_at?: string;
  room_url: string;
  domain: string;
  room_code: string;
  has_password: boolean;
  status: string;
  status_label: string;
  status_detail: string | null;
  music_enabled: boolean;
  auto_connect: boolean;
  test_report: string | null;
  stats: { bytes: number; participants: TableSpeaker[] };
  participants: TableParticipant[];
  utterances: TableUtterance[];
  recap: TableRecap | null;
  music?: { path: string; started_at?: string; ended_at?: string; position_start: number; position_end: number }[];
};

export class TableApiService extends BaseApiClient {
  getTable(sessionId: string): Promise<TableState | null> {
    return this.get<TableState | null>(`/sessions/${sessionId}/table`);
  }

  start(sessionId: string, roomUrl: string, password: string): Promise<TableState> {
    return this.put<TableState>(`/sessions/${sessionId}/table`, {
      room_url: roomUrl,
      password: password || null,
    });
  }

  stop(sessionId: string): Promise<{ status: string; status_label: string }> {
    return this.post(`/sessions/${sessionId}/table/stop`);
  }

  music(sessionId: string, enabled: boolean): Promise<{ music_enabled: boolean }> {
    return this.post(`/sessions/${sessionId}/table/music`, { enabled });
  }

  auto(sessionId: string, enabled: boolean, roomUrl: string, password: string): Promise<TableState> {
    return this.post(`/sessions/${sessionId}/table/auto`, {
      enabled,
      room_url: roomUrl,
      password: password || null,
    });
  }

  runs(sessionId: string): Promise<TableState[]> {
    return this.get<TableState[]>(`/sessions/${sessionId}/table/runs`);
  }

  archive(scenarioId: string): Promise<{ approaches: { id: string; name: string; created_at?: string; runs: TableState[] }[] }> {
    return this.get(`/scenarios/${scenarioId}/table-archive`);
  }

  bind(
    sessionId: string,
    participantId: string,
    kind: '' | 'character' | 'master' | 'observer',
    characterId: string | null,
    observerCode: string | null,
  ): Promise<{ id: string; character_id: string | null; bind_kind: string; observer_code: string | null }> {
    return this.patch(`/sessions/${sessionId}/table/participants/${participantId}`, {
      kind,
      character_id: characterId,
      observer_code: observerCode,
    });
  }

  test(sessionId: string): Promise<{ pending: boolean; test_report: string | null }> {
    return this.post(`/sessions/${sessionId}/table/test`);
  }

  lobbyTable(lobbyId: string): Promise<LobbyTable> {
    return this.get(`/lobbies/${lobbyId}/table`);
  }

  lobbyStart(lobbyId: string, roomUrl: string, password: string | null, enter: boolean): Promise<LobbyTable> {
    return this.put(`/lobbies/${lobbyId}/table`, {
      room_url: roomUrl,
      password,
      enter,
    });
  }

  lobbyStop(lobbyId: string): Promise<LobbyTable> {
    return this.post(`/lobbies/${lobbyId}/table/stop`);
  }

  lobbyMusic(lobbyId: string, enabled: boolean): Promise<{ music_enabled: boolean }> {
    return this.post(`/lobbies/${lobbyId}/table/music`, { enabled });
  }

  lobbyAuto(lobbyId: string, enabled: boolean): Promise<LobbyTable> {
    return this.post(`/lobbies/${lobbyId}/table/auto`, { enabled });
  }

  lobbyTest(lobbyId: string): Promise<{ pending: boolean; test_report: string | null }> {
    return this.post(`/lobbies/${lobbyId}/table/test`);
  }

  recap(sessionId: string): Promise<TableRecap> {
    return this.request<TableRecap>(`/sessions/${sessionId}/table/recap`, {
      method: 'POST',
      timeout: 180000,
    });
  }
}

export const tableApi = new TableApiService();
