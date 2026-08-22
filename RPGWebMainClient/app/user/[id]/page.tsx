'use client'

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil } from "lucide-react";
import Header from "@/app/components/layout/Header";
import { useAccessGroupsApiLogic } from "@/app/services/hooks/useAccessGroups";
import { useAccessGroupsStore } from "@/app/services/stores/access_groups";
import { userApiService } from "@/app/services/api/users";
import { MasterGroup } from "@/app/services/types/access_groups";
import { User } from "@/app/services/types/auth";

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params.id;

  const { users } = useAccessGroupsStore();
  const { fetchUsers } = useAccessGroupsApiLogic();

  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<MasterGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Загрузить профиль пользователя и группы
  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      try {
        if (!users.length) await fetchUsers();
        const userData = await userApiService.getUser(userId);
        const master_groups = await userApiService.getUserGroups(userId);
        setUser(userData);

        if (master_groups) {
          setGroups(master_groups);
        }
      } catch (e) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, fetchUsers, users.length]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        Пользователь не найден.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section={`Пользователь: ${user.full_name || user.telegram_id || user.email}`} />
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-white">Профиль пользователя</h2>
          <Link href={`/users/${user.id}/settings`}>
            <Button variant="secondary" size="sm" className="ml-4">
              <Pencil className="w-4 h-4 mr-1" /> Редактировать пользователя
            </Button>
          </Link>
        </div>
        <div className="mb-8">
          <div className="mb-3"><span className="text-gray-400">ID:</span> <span className="font-mono">{user.id}</span></div>
          <div className="mb-3"><span className="text-gray-400">Имя:</span> {user.full_name || user.telegram_id}</div>
          <div className="mb-3"><span className="text-gray-400">Email:</span> {user.email}</div>
        </div>

        <h3 className="font-bold mb-2">Группы пользователя</h3>
        {groups.length === 0 ? (
          <div className="text-gray-500 mb-8">Пользователь не состоит ни в одной группе</div>
        ) : (
          <ul className="space-y-2 mb-8">
            {groups.map(group => (
              <li key={group.id} className="bg-gray-800 rounded p-3 flex justify-between items-center">
                <span>{group.name}</span>
                <Link href={`/groups/${group.id}/settings`}>
                  <Button variant="outline" size="sm">
                    <Pencil className="w-4 h-4 mr-1" /> Редактировать группу
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div>
          <Button variant="outline" onClick={() => router.push('/access_groups')}>← Ко всем группам и пользователям</Button>
        </div>
      </div>
    </div>
  );
}
