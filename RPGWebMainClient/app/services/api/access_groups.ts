import { BaseApiClient } from './base';
import {
  MasterGroup,
  MasterGroupCreate,
  MasterGroupAddUser,
  MasterGroupScenarioAccess,
} from '../types/access_groups';
import { User } from '../types/auth';

export class AccessGroupsApiService extends BaseApiClient {
  private readonly endpoint = '/access_groups';

  async getGroups(): Promise<MasterGroup[]> {
    return this.get<MasterGroup[]>(this.endpoint);
  }

  async getGroup(groupId: string): Promise<MasterGroup> {
    return this.get<MasterGroup>(`${this.endpoint}/${groupId}`);
  }

  async createGroup(data: MasterGroupCreate): Promise<MasterGroup> {
    return this.post<MasterGroup>(this.endpoint, data);
  }

  async addUserToGroup(data: MasterGroupAddUser): Promise<void> {
    return this.post<void>(`${this.endpoint}/add_user`, data);
  }

  async updateGroup(id: string, data: { name: string }): Promise<any> {
    return this.patch(`${this.endpoint}/${id}`, data);
  }

  async deleteGroup(id: string): Promise<any> {
    return this.delete(`${this.endpoint}/${id}`);
  }

  async removeUserFromGroup(data: { group_id: string, user_id: string }): Promise<void> {
    return this.post(`${this.endpoint}/remove_user`, data);
  }

  // ---------- SCENARIO ACCESS ----------
  /** Сценарии, открытые группе. Обратный разрез для карточки группы. */
  async getGroupScenarios(groupId: string): Promise<MasterGroupScenarioAccess[]> {
    return this.get<MasterGroupScenarioAccess[]>(
      `${this.endpoint}/${groupId}/scenarios`
    );
  }

  async getScenarioGroupAccess(
    scenarioId: string
  ): Promise<MasterGroupScenarioAccess[]> {
    return this.get<MasterGroupScenarioAccess[]>(
      `${this.endpoint}/scenarios/${scenarioId}/groups`
    );
  }

  async setScenarioGroupAccess(
    scenarioId: string,
    data: MasterGroupScenarioAccess
  ): Promise<MasterGroupScenarioAccess> {
    return this.post<MasterGroupScenarioAccess>(
      `${this.endpoint}/scenarios/${scenarioId}/groups`,
      data
    );
  }

  async deleteScenarioGroupAccess(
    scenarioId: string,
    groupId: string
  ): Promise<void> {
    return this.delete<void>(
      `${this.endpoint}/scenarios/${scenarioId}/groups/${groupId}`
    );
  }

  async getScenarioMaxPermission(scenarioId: string): Promise<string> {
    const result = await this.get<{ max_permission: string }>(
      `${this.endpoint}/scenarios/${scenarioId}/max_perm`
    );
    return result.max_permission;
  }
}

export const accessGroupsApiService = new AccessGroupsApiService();
