import { BaseApiClient } from './base';

export type PlayedEvening = {
  session_id: string;
  name: string;
  created_at?: string | null;
  is_active: boolean;
  character_name?: string | null;
};

export type PlayedGame = {
  id: string;
  name: string;
  master_name?: string | null;
  character_name?: string | null;
  color?: string | null;
  active_session_id?: string | null;
  played_at?: string | null;
  evenings: PlayedEvening[];
};

export type MyCharacter = {
  id: string;
  name: string;
  short_desc?: string | null;
  img_url?: string | null;
  icon_url?: string | null;
  games: { scenario_id: string; name: string }[];
};

class PlayerCabinetApi extends BaseApiClient {
  games(): Promise<{ items: PlayedGame[] }> {
    return this.get('/users/me/played-games');
  }

  characters(): Promise<{ items: MyCharacter[] }> {
    return this.get('/users/me/characters');
  }
}

export const playerCabinetApi = new PlayerCabinetApi();
