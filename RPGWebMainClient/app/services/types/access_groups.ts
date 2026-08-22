import { User } from './auth';


export enum RoleAccess {
  NONE_ROLE = 'none',
  READ_ROLE = 'read',
  EDIT_PARTIAL_ROLE = 'edit_partial',
  EDIT_FULL_ROLE = 'edit_full',
  ALL_ROLE = 'all',
}

export const ROLE_ACCESS_LABELS: Record<RoleAccess, string> = {
  [RoleAccess.NONE_ROLE]: 'Нет доступа',
  [RoleAccess.READ_ROLE]: 'Только смотреть',
  [RoleAccess.EDIT_PARTIAL_ROLE]: 'Править содержимое',
  [RoleAccess.EDIT_FULL_ROLE]: 'Править сценарий',
  [RoleAccess.ALL_ROLE]: 'Полный доступ',
};

export const ROLE_ACCESS_HINTS: Record<RoleAccess, string> = {
  [RoleAccess.NONE_ROLE]: 'Сценарий не виден участникам группы',
  [RoleAccess.READ_ROLE]: 'Видят сценарий и могут его скопировать',
  [RoleAccess.EDIT_PARTIAL_ROLE]: 'Правят локации, НПС, предметы и прочее наполнение',
  [RoleAccess.EDIT_FULL_ROLE]: 'Плюс название, описание и настройки сценария',
  [RoleAccess.ALL_ROLE]: 'Плюс удаление сценария и выдача доступа другим',
};


interface MasterGroupBase {
  name: string;
};

export interface MasterGroup extends MasterGroupBase {
  id: string;
  users?: User[];
};

export interface MasterGroupCreate extends MasterGroupBase {
};


export type MasterGroupAddUser = {
  group_id: string;
  user_id: string;
  permission: string;
};


export interface MasterGroupScenarioAccessBase {
  master_group_id: string;
  scenario_id: string;
  permission: RoleAccess;
}

export interface MasterGroupScenarioAccessCreate
  extends MasterGroupScenarioAccessBase {}

/** Со стороны сценария приходит группа, со стороны группы — название сценария. */
export interface MasterGroupScenarioAccess
  extends MasterGroupScenarioAccessBase {
  master_group?: MasterGroup;
  scenario_name?: string | null;
}
