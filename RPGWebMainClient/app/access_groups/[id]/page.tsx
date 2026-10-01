'use client'

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, ArrowLeft, Plus } from "lucide-react";
import Header from "@/app/components/layout/Header";
import { useAccessGroupsApiLogic } from "@/app/services/hooks/useAccessGroups";
import { accessGroupsApiService } from "@/app/services/api/access_groups";
import { UserSearchPicker } from "@/app/components/access_groups/UserSearchPicker";
import { UserRoleBadges, userDisplayName } from "@/app/components/access_groups/UserRoleBadges";
import { useAccessGate } from "@/app/components/layout/AccessDenied";
import { GroupScenariosSection } from "@/app/components/access_groups/GroupScenariosSection";
import { RoleAccess } from "@/app/services/types/access_groups";
import type { User } from "@/app/services/types/auth";

function apiErrorMessage(e: unknown, fallback: string): string {
  const err = e as { message?: string; detail?: string | { detail?: string } };
  if (typeof err?.detail === 'string') return err.detail;
  if (typeof err?.detail === 'object' && err.detail?.detail) return String(err.detail.detail);
  return err?.message || fallback;
}

const MEMBER_LEVELS: { value: string; label: string }[] = [
  { value: RoleAccess.READ_ROLE, label: "Только чтение" },
  { value: RoleAccess.EDIT_PARTIAL_ROLE, label: "Правка сущностей" },
  { value: RoleAccess.EDIT_FULL_ROLE, label: "Полная правка" },
  { value: RoleAccess.ALL_ROLE, label: "Всё (как у группы)" },
];

export default function GroupSettingsPage() {
  const gate = useAccessGate('admin');
  if (gate) return gate;
  return <GroupSettings />;
}

function GroupSettings() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const groupId = params.id;

  const { groups, groupUsers, users, loading, fetchGroups, fetchGroup, fetchUsers, addUserToGroup } = useAccessGroupsApiLogic();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const group = groups.find(g => g.id === groupId);
  const groupUsersList = groupUsers[groupId] || [];
  const allUsers = users;

  const [name, setName] = useState(group?.name || "");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [addLoading, setAddLoading] = useState(false);
  const [memberLevels, setMemberLevels] = useState<Record<string, string>>({});

  const loadMemberLevels = useCallback(async () => {
    try {
      setMemberLevels(await accessGroupsApiService.getMemberLevels(groupId));
    } catch {
      /* уровни — вторичная информация */
    }
  }, [groupId]);

  useEffect(() => { loadMemberLevels(); }, [loadMemberLevels, groupUsers]);

  const handleChangeLevel = async (userId: string, permission: string) => {
    try {
      await accessGroupsApiService.setUserPermission({ group_id: groupId, user_id: userId, permission });
      setMemberLevels((prev) => ({ ...prev, [userId]: permission }));
      setError(null);
    } catch (e: unknown) {
      setError(apiErrorMessage(e, "Не удалось изменить уровень участника"));
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchGroup(groupId);
    fetchUsers();
  }, [groupId, fetchGroups, fetchGroup, fetchUsers]);

  useEffect(() => { if (group) setName(group.name); }, [group]);

  const handleRename = async () => {
    if (!group || !name.trim()) return;
    try {
      setSaving(true);
      await accessGroupsApiService.updateGroup(group.id, { name });
      fetchGroups();
      setError(null);
    } catch (e: unknown) {
      setError(apiErrorMessage(e, "Ошибка при изменении имени группы"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group) return;
    if (confirm("Удалить группу безвозвратно?")) {
      await accessGroupsApiService.deleteGroup(group.id);
      router.push("/access_groups");
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!group) return;
    try {
      await accessGroupsApiService.removeUserFromGroup({ group_id: group.id, user_id: userId });
      await fetchGroup(group.id);
      setError(null);
    } catch (e: unknown) {
      setError(apiErrorMessage(e, "Ошибка удаления пользователя из группы"));
    }
  };

  const handleAddUser = async () => {
    if (!group || !selectedUserId) return;
    setAddLoading(true);
    try {
      await addUserToGroup({
        group_id: group.id,
        user_id: selectedUserId,
        permission: RoleAccess.ALL_ROLE,
      });
      setSelectedUserId('');
      setError(null);
    } catch (e: unknown) {
      setError(apiErrorMessage(e, "Ошибка добавления пользователя"));
    } finally {
      setAddLoading(false);
    }
  };

  const groupMemberIds = new Set(groupUsersList.map((u) => u.id));
  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const enrichedGroupUsers = groupUsersList.map((u) => userById.get(u.id) ?? u);
  const availableUsers: User[] = allUsers.filter(
    (u) => u.id && !groupMemberIds.has(u.id),
  );

  if (loading || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section={`Настройки группы: ${group.name}`} />
      <div className="max-w-xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/access_groups`}>
            <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
              <ArrowLeft className="w-4 h-4 mr-2" /> К группам
            </Button>
          </Link>
          <h2 className="text-xl font-bold text-white">Настройки группы</h2>
        </div>
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Название группы</label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            className="mb-2"
            disabled={saving}
          />
          <Button
            onClick={handleRename}
            disabled={saving || !name.trim() || name === group.name}
            variant="secondary"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Сохранить
          </Button>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1 text-gray-300">ID группы</label>
          <div className="font-mono text-gray-400">{group.id}</div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Добавить пользователя в группу</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <UserSearchPicker
              users={availableUsers}
              value={selectedUserId}
              onChange={setSelectedUserId}
              disabled={addLoading || availableUsers.length === 0}
            />
            <Button
              onClick={handleAddUser}
              disabled={!selectedUserId || addLoading}
              variant="secondary"
              className="shrink-0"
            >
              {addLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Добавить
            </Button>
          </div>
          {availableUsers.length === 0 ? (
            <p className="text-xs text-gray-500 mt-2">Все пользователи уже в группе или список пуст.</p>
          ) : null}
        </div>

        <div className="mb-8">
          <h3 className="font-bold mb-2">Пользователи группы</h3>
          {groupUsersList.length === 0 ? (
            <div className="text-gray-500">Пока никто не добавлен</div>
          ) : (
            <ul className="space-y-1">
              {enrichedGroupUsers.map(u => (
                <li key={u.id} className="flex items-center justify-between bg-gray-800 rounded p-2 gap-2">
                  <Link href={`/user/${u.id}`} className="min-w-0">
                    <span className="inline-flex items-center flex-wrap gap-1">
                      <span>{userDisplayName(u)}</span>
                      <UserRoleBadges user={u} />
                    </span>
                    {u.email ? <span className="text-gray-500 text-sm block truncate">{u.email}</span> : null}
                  </Link>
                  <select
                    className="bg-gray-700 text-sm rounded px-2 py-1 border border-gray-600"
                    title="Потолок прав участника: итог = минимум из этого уровня и прав группы на сценарий"
                    value={memberLevels[u.id] ?? RoleAccess.ALL_ROLE}
                    onChange={(e) => handleChangeLevel(u.id, e.target.value)}
                  >
                    {MEMBER_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                  <Button
                    size="icon"
                    variant="destructive"
                    title="Удалить из группы"
                    onClick={() => handleRemoveUser(u.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-8">
          <GroupScenariosSection groupId={groupId} />
        </div>

        <div className="flex justify-end">
          <Button variant="destructive" onClick={handleDeleteGroup}>
            <Trash2 className="w-4 h-4 mr-2" /> Удалить группу навсегда
          </Button>
        </div>
        {error && <div className="text-red-500 mt-4">{error}</div>}
      </div>
    </div>
  );
}
