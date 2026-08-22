'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Save, Image as ImageIcon, Undo2 } from "lucide-react";
import Header from "@/app/components/layout/Header";
import { useAuth } from "@/app/services/hooks/useAuth";
import { userApiService } from "@/app/services/api/users";
import { useAccessGroupsApiLogic } from "@/app/services/hooks/useAccessGroups";
import { MasterGroup } from "@/app/services/types/access_groups";
import { User } from "../services";
import { campaignsApiService } from '@/app/services/api/campaign';
import { launchedScenariosApi } from '@/app/services/api/launchedScenarios';
import { CampaignProfile } from '@/app/services/types/sessionDispatch';
import { LaunchedScenario } from '@/app/services/types/launchedScenario';
import { SessionHistoryList } from '@/app/components/profile/SessionHistoryList';
import { MasterPendingBadge } from '@/app/components/applications/MasterPendingBadge';
import Link from 'next/link';
import { RequireAuth } from '@/app/components/auth/RequireAuth';

// Импортируйте свою компоненту для загрузки аватара или используйте обычный input[type='file']

export default function MePage() {
  return (
    <RequireAuth>
      <MePageContent />
    </RequireAuth>
  );
}

function MePageContent() {
  const { state, refreshAuth } = useAuth();
  const { user, loading: authLoading } = state;
  const { fetchUsers } = useAccessGroupsApiLogic();

  const [groups, setGroups] = useState<MasterGroup[]>([]);
  const [campaignProfile, setCampaignProfile] = useState<CampaignProfile | null>(null);
  const [launchedScenarios, setLaunchedScenarios] = useState<LaunchedScenario[]>([]);
  const [editUser, setEditUser] = useState<UserUpdate | null>(null);
  const [editAvatar, setEditAvatar] = useState<string | null>(user?.icon_url || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Пароль
  const [showPassForm, setShowPassForm] = useState(false);
  const [repeatPass, setRepeatPass] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  // Основное состояние
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      campaignsApiService.getProfile().then(setCampaignProfile).catch(() => setCampaignProfile(null)),
      launchedScenariosApi.list().then(setLaunchedScenarios).catch(() => setLaunchedScenarios([])),
    ]);
  }, [user]);

  // Загрузить группы пользователя
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const master_groups = await userApiService.getUserGroups(user.id);
      if (master_groups) {
        setGroups(master_groups);
      }
    };
    fetchData();
  }, [user]);

  // Аватарка превью
  useEffect(() => {
    if (avatarFile) {
      const url = URL.createObjectURL(avatarFile);
      setEditAvatar(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [avatarFile]);

  // Сбросить изменения
  const handleReset = () => {
    setEditUser(null);
    setEditAvatar(null);
    setAvatarFile(null);
    setError(null);
    setSuccess(null);
  };

  // Сохранить изменения профиля
  const handleSave = async () => {
    if (!user || !editUser) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let updated = await userApiService.updateMe(editUser);
      if (avatarFile) {
        // updated = await userApiService.uploadAvatar(avatarFile);
      }
      refreshAuth(); // Вызывайте из вашего useAuth или заново загрузите себя
      setSuccess("Профиль обновлён!");
      setEditUser(null);
    } catch (e: any) {
      setError(e?.message || "Ошибка сохранения данных");
    } finally {
      setSaving(false);
    }
  };

  // Смена пароля
  const handleChangePassword = async () => {
    if (!user || !editUser) return;
    setPassLoading(true);
    setPassError(null);
    setPassSuccess(null);
    if (!editUser.new_password || !repeatPass) {
    // if ((!editUser.old_password && hasPassword) || !editUser.new_password || !repeatPass) {
      setPassError("Все поля обязательны");
      setPassLoading(false);
      return;
    }
    if (editUser.new_password !== repeatPass) {
      setPassError("Пароли не совпадают");
      setPassLoading(false);
      return;
    }
    try {
      await userApiService.updateMe(editUser);
      setPassSuccess("Пароль успешно изменён");
      setRepeatPass("");
      setEditUser(null); 
      setShowPassForm(false);
    } catch (e: any) {
      setPassError(e?.message || "Ошибка смены пароля");
    } finally {
      setPassLoading(false);
    }
  };


  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // TODO tg users
  const hasPassword = true;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section="Профиль" />
      <div className="max-w-xl mx-auto p-6">
        <div className="mb-2">
          <Link href="/?tab=profile" className="text-sm text-sky-400 hover:text-sky-300">
            ← К статистике на главной
          </Link>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-white">Настройки профиля</h2>
          {!editUser && (
            <Button onClick={() => setEditUser(user)} variant="secondary" size="sm" className="ml-2">
              <Pencil className="w-4 h-4 mr-1" /> Редактировать
            </Button>
          )}
        </div>

        <div className="mb-8 flex gap-4 items-center">
          {/* Аватар */}
          <div>
            <img
              src={user.img_url || "/no-avatar.png"}
              alt="avatar"
              className="w-24 h-24 rounded-full border-2 border-gray-700 object-cover"
            />
            {editUser && (
              <label
                className="block mt-2 cursor-pointer text-sm text-blue-400 hover:underline"
                title="Загрузить новый аватар"
              >
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={e => setAvatarFile(e.target.files?.[0] || null)}
                />
                <ImageIcon className="w-4 h-4 mr-1 inline" /> Изменить аватар
              </label>
            )}
          </div>
          <div className="flex-1">
            {!editUser ? (
              <div>
                <div className="mb-2"><span className="text-gray-400">Имя:</span> {user.full_name}</div>
                <div className="mb-2"><span className="text-gray-400">Email:</span> {user.email}</div>
              </div>
            ) : (
              <div>
                <label className="text-sm mb-1 block">Имя</label>
                <Input
                  value={editUser?.full_name}
                  onChange={e => setEditUser({...editUser, full_name: e.target.value})}
                  className="mb-2"
                  disabled={saving}
                />
              </div>
            )}
            <div className="flex gap-2 mt-3">
              {editUser && (
                <>
                  <Button onClick={handleSave} disabled={saving || !editUser?.full_name.trim()} variant="secondary">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Сохранить
                  </Button>
                  <Button onClick={handleReset} variant="outline" disabled={saving}>
                    <Undo2 className="w-4 h-4 mr-2" />
                    Отмена
                  </Button>
                </>
              )}
            </div>
            {success && <div className="text-green-500 mt-2">{success}</div>}
            {error && <div className="text-red-500 mt-2">{error}</div>}
          </div>
        </div>

        {user.can_be_master && (
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <h3 className="font-bold w-full sm:w-auto">Мастер</h3>
            <MasterPendingBadge />
            <Link href="/master/applications">
              <Button variant="outline" size="sm" className="border-gray-600 text-gray-300">
                Все заявки
              </Button>
            </Link>
          </div>
        )}

        <div className="mb-8">
          <h3 className="font-bold mb-2">Запущенные сценарии</h3>
          {!launchedScenarios.length ? (
            <div className="text-gray-500 mb-3">Нет активных запущенных сценариев</div>
          ) : (
            <ul className="space-y-2 mb-4">
              {launchedScenarios.map((s) => (
                <li key={s.id} className="bg-gray-800 rounded p-3">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {s.lifecycle_status === 'running' ? 'В игре' : s.lifecycle_status}
                  </div>
                  <Link href={`/scenarios/${s.id}`} className="text-sm text-amber-400 hover:underline mt-1 inline-block mr-3">
                    Редактировать мир
                  </Link>
                  {s.source_scenario_id ? (
                    <Link href={`/scenarios/${s.source_scenario_id}`} className="text-sm text-blue-400 hover:underline mt-1 inline-block">
                      Исходный сценарий
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <Link href="/launched-scenarios">
            <Button variant="outline" size="sm">Все запущенные</Button>
          </Link>
        </div>

        <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/60 p-4">
          <h3 className="font-bold mb-1">Броски и статистика</h3>
          <p className="text-sm text-gray-400 mb-3">
            Сводка по сессиям и недавние броски — на главной во вкладке «Профиль».
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/?tab=profile">
              <Button variant="secondary" size="sm">Открыть статистику</Button>
            </Link>
            <Link href="/me/rolls">
              <Button variant="outline" size="sm" className="border-gray-600">Все броски</Button>
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-bold mb-2">История сессий</h3>
          <SessionHistoryList
            items={campaignProfile?.session_history ?? []}
            emptyText="История пуста"
            maxHeightClass="max-h-64"
          />
        </div>

        <div className="mb-8">
          <h3 className="font-bold mb-2">Мои группы</h3>
          {groups.length === 0 ? (
            <div className="text-gray-500 mb-3">Вы не входите ни в одну группу</div>
          ) : (
            <ul className="space-y-2">
              {groups.map(g => (
                <li key={g.id} className="bg-gray-800 rounded p-3 flex justify-between">
                  <span>{g.name}</span>
                  <Link href={`/groups/${g.id}/settings`}>
                    <Button variant="outline" size="sm">Управлять</Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Блок смены пароля */}
        <div className="mb-8">
          <Button 
            onClick={() => { 
              if (!showPassForm) {
                setEditUser(user);
              } else {
                setEditUser(null);
              }
              setShowPassForm(v => !v); 
            }} 
            variant="outline" 
            size="sm" 
            className="mb-3"
          >
            {showPassForm && editUser ? "Отмена смены пароля" : "Сменить пароль"}
          </Button>
          {showPassForm && editUser && (
            <div className="space-y-3 border border-gray-700 rounded-lg p-4 bg-gray-800">
              {hasPassword && (
                <Input
                  type="password"
                  placeholder="Старый пароль"
                  value={editUser.old_password || ''}
                  onChange={e => setEditUser({...editUser, old_password: e.target.value})}
                  disabled={passLoading}
                />
              )}
              <Input
                type="password"
                placeholder="Новый пароль"
                value={editUser.new_password}
                onChange={e => setEditUser({...editUser, new_password: e.target.value})}
                disabled={passLoading}
              />
              <Input
                type="password"
                placeholder="Повторите новый пароль"
                value={repeatPass}
                onChange={e => setRepeatPass(e.target.value)}
                disabled={passLoading}
              />
              <Button
                onClick={handleChangePassword}
                // disabled={passLoading || (!editUser?.old_password?.trim() && hasPassword) || !editUser?.new_password?.trim() || !repeatPass.trim()}
                variant="secondary"
              >
                {passLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Сменить пароль
              </Button>
              {passError && <div className="text-red-500 mt-2">{passError}</div>}
              {passSuccess && <div className="text-green-500 mt-2">{passSuccess}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
