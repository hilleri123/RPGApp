import { BaseApiClient } from './base';
import { User, UserAdminPatch, UserUpdate } from '../types/auth';
import { MasterGroup } from '../types/access_groups';

export type RollRecord = {
  id: string;
  session_id: string;
  user_id: string;
  action_id?: string | null;
  action_key?: string | null;
  roll_kind: string;
  system_id?: string | null;
  title?: string | null;
  expression?: string | null;
  dice: number[];
  total?: number | null;
  outcome?: string | null;
  seed_hash?: string | null;
  seed_image_url?: string | null;
  meta?: Record<string, unknown>;
  created_at: string;
};

export type RollListResponse = {
  items: RollRecord[];
  stats: {
    total_rolls: number;
    by_kind: Record<string, number>;
    avg_total?: number | null;
    with_seed_image: number;
  };
  total: number;
  skip: number;
  limit: number;
};

export class UserApiService extends BaseApiClient {
  private readonly endpoint = '/users';

  async getUsers(params?: { skip?: number; limit?: number; q?: string }): Promise<User[]> {
    return this.get<User[]>(`${this.endpoint}/`, params);
  }

  async getMe(): Promise<User> {
    return this.get<User>(`${this.endpoint}/me`);
  }

  async getUser(userId: string): Promise<User> {
    return this.get<User>(`${this.endpoint}/${userId}`);
  }

  async updateMe(data: UserUpdate): Promise<User> {
    return this.put<User>(`${this.endpoint}/me`, data);
  }

  async adminUpdateUser(userId: string, data: UserAdminPatch): Promise<User> {
    return this.patch<User>(`${this.endpoint}/${userId}`, data);
  }

  async getUserGroups(userId: string): Promise<MasterGroup[]> {
    return this.get<MasterGroup[]>(`${this.endpoint}/${userId}/groups`);
  }

  async getMyRolls(params?: {
    skip?: number;
    limit?: number;
    session_id?: string;
    roll_kind?: string;
  }): Promise<RollListResponse> {
    return this.get<RollListResponse>(`${this.endpoint}/me/rolls`, params);
  }

  async getMyRoll(rollId: string): Promise<RollRecord> {
    return this.get<RollRecord>(`${this.endpoint}/me/rolls/${rollId}`);
  }
}

export const userApiService = new UserApiService();
