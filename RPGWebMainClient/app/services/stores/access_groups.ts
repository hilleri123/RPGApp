import { create } from 'zustand';
import { MasterGroup } from '@/app/services/types/access_groups';
import { User } from '../types/auth';

interface AccessGroupsStore {
  groups: MasterGroup[];
  groupUsers: Record<string, User[]>;
  users: User[];
  loading: boolean;
  error: string | null;

  setGroups: (groups: MasterGroup[]) => void;
  setGroupUsers: (groupId: string, users: User[]) => void;
  setUsers: (users: User[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (msg: string | null) => void;
  clear: () => void;
}

export const useAccessGroupsStore = create<AccessGroupsStore>((set) => ({
  groups: [],
  groupUsers: {},
  users: [],
  loading: false,
  error: null,

  setGroups: (groups) => set({ groups }),

  setGroupUsers: (groupId, users) =>
    set((state) => ({
      groupUsers: { ...state.groupUsers, [groupId]: users }
    })),

  setUsers: (users) => set({ users }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clear: () => set({ groups: [], groupUsers: {}, users: [], loading: false, error: null }),
}));
