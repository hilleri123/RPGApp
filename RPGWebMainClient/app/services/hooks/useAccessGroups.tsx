import { useCallback } from 'react';
import { useAccessGroupsStore } from '@/app/services/stores/access_groups';
import { accessGroupsApiService } from '@/app/services/api/access_groups';
import { userApiService } from '@/app/services/api/users';
import { MasterGroupCreate, MasterGroupAddUser } from '@/app/services/types/access_groups';

// Универсальный хук для работы с группами и пользователями
export function useAccessGroupsApiLogic() {
  const {
    users, groupUsers, groups, loading, error, setGroups, setGroupUsers, setUsers, setLoading, setError
  } = useAccessGroupsStore();

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const groups = await accessGroupsApiService.getGroups();
      setGroups(groups);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки групп');
    } finally {
      setLoading(false);
    }
  }, [setGroups, setLoading, setError]);

  const createGroup = useCallback(async (data: MasterGroupCreate) => {
    try {
      const group = await accessGroupsApiService.createGroup(data);
      fetchGroups();
      return group;
    } catch (e) {
      setError('Ошибка создания группы');
      throw e;
    }
  }, [setError, fetchGroups]);

  const fetchGroup = useCallback(async (groupId: string) => {
    setLoading(true);
    setError(null);
    try {
      const group = await accessGroupsApiService.getGroup(groupId);
      setGroups(
        (() => {
          const idx = groups.findIndex(g => g.id === group.id);
          if (idx !== -1) {
            const copy = [...groups];
            copy[idx] = group;
            return copy;
          } else {
            return [...groups, group];
          }
        })()
      );
      setGroupUsers(groupId, group.users || []);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки пользователей группы');
    } finally {
      setLoading(false);
    }
  }, [setGroupUsers, setLoading, setError]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const users = await userApiService.getUsers({ limit: 500 });
      setUsers(users);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  }, [setUsers, setLoading, setError]);

  const addUserToGroup = useCallback(
    async (data: MasterGroupAddUser) => {
      await accessGroupsApiService.addUserToGroup(data);
      fetchGroup(data.group_id);
    },
    [fetchGroup]
  );

  return {
    users, groupUsers, groups, loading, error,
    fetchGroups,
    createGroup,
    fetchGroup,
    fetchUsers,
    addUserToGroup,
  };
}
