'use client'

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Header from "@/app/components/layout/Header";
import { useAccessGroupsStore } from "@/app/services/stores/access_groups";
import { useAccessGroupsApiLogic } from "@/app/services/hooks/useAccessGroups";
import { useAuth } from "../services";
import { UserRoleBadges, userDisplayName } from "@/app/components/access_groups/UserRoleBadges";
import { UserRolesRow } from "@/app/components/access_groups/UserRolesRow";
import { useAccessGate } from "@/app/components/layout/AccessDenied";

export default function AccessGroupsPage() {
  const gate = useAccessGate('master');
  if (gate) return gate;
  return <AccessGroups />;
}

function AccessGroups() {
  const { state } = useAuth();
  const isAdmin = Boolean(state.user?.is_admin);
  const { users, groups, loading, error, fetchGroups, fetchUsers, createGroup } = useAccessGroupsApiLogic();

  const [groupSearch, setGroupSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [activeTab, setActiveTab] = useState('groups');

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  // Добавление группы
  const handleAddGroup = async () => {
    const name = prompt("Введите имя группы");
    if (name) await createGroup({ name });
  };

  // Фильтрация
  const filteredGroups = groups.filter(g =>
    g.name?.toLowerCase().includes(groupSearch.trim().toLowerCase())
  );
  const filteredUsers = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(userSearch.trim().toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.trim().toLowerCase()) ||
    String(u.telegram_id ?? '').includes(userSearch.trim())
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section={isAdmin ? 'Доступ: группы и пользователи' : 'Группы доступа'} />
      <div className="max-w-4xl mx-auto p-6">
        {!isAdmin && (
          <p className="mb-4 text-sm text-gray-400">
            Список групп, которым можно открыть доступ к вашим сценариям. Состав групп и роли
            пользователей настраивает администратор.
          </p>
        )}
        <Tabs defaultValue="groups" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid mb-6 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="groups">Группы</TabsTrigger>
            {isAdmin && <TabsTrigger value="users">Пользователи</TabsTrigger>}
          </TabsList>

          {/* Tab: Группы */}
          <TabsContent value="groups">
            <div className="flex items-center gap-4 mb-4">
              <Input
                placeholder="Поиск группы по названию..."
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
                className="bg-gray-800 text-white"
              />
              {isAdmin && (
                <Button onClick={handleAddGroup} variant="secondary" size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Добавить
                </Button>
              )}
            </div>
            {loading ? (
              <div className="py-8 text-gray-400 text-center">Загрузка групп...</div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-8 text-gray-400 text-center">Нет подходящих групп</div>
            ) : (
              <ul className="space-y-2">
                {filteredGroups.map(group => (
                  <li key={group.id} className="bg-gray-800 rounded p-3 flex justify-between items-center">
                    <span>{group.name}</span>
                    {isAdmin ? (
                      <Link href={`/access_groups/${group.id}`}>
                        <Button variant="outline" size="sm">Настройки</Button>
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {error && <div className="text-red-500 mt-3">{error}</div>}
          </TabsContent>

          {/* Tab: Пользователи */}
          {isAdmin && (
          <TabsContent value="users">
            <div className="mb-4">
              <Input
                placeholder="Поиск пользователя..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="bg-gray-800 text-white"
              />
            </div>
            {loading ? (
              <div className="py-8 text-gray-400 text-center">Загрузка пользователей...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-8 text-gray-400 text-center">Нет подходящих пользователей</div>
            ) : (
              <ul className="space-y-2">
                {filteredUsers.map(user => (
                  <li
                    key={user.id}
                    className="bg-gray-800 rounded p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"
                  >
                    <Link href={`/user/${user.id}`} className="min-w-0">
                      <span className="inline-flex items-center flex-wrap gap-1">
                        <span>{userDisplayName(user)}</span>
                        <UserRoleBadges user={user} />
                      </span>
                      <span className="text-gray-400 text-sm block truncate">{user.email}</span>
                    </Link>
                    <UserRolesRow
                      user={user}
                      isSelf={user.id === state.user?.id}
                      onChanged={fetchUsers}
                    />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
