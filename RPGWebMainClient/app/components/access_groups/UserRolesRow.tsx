'use client';

import { useState } from 'react';
import { Crown, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { userApiService } from '@/app/services/api/users';
import type { User } from '@/app/services/types/auth';

/**
 * Переключатели ролей. До этого can_be_master и is_admin проставлялись только
 * запросом в базу, из-за чего нового мастера нельзя было завести без доступа к серверу.
 */
export function UserRolesRow({
  user,
  isSelf,
  onChanged,
}: {
  user: User;
  isSelf: boolean;
  onChanged: (updated: User) => void;
}) {
  const [busy, setBusy] = useState<'master' | 'admin' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (field: 'can_be_master' | 'is_admin') => {
    setBusy(field === 'can_be_master' ? 'master' : 'admin');
    setError(null);
    try {
      const updated = await userApiService.adminUpdateUser(user.id, {
        [field]: !user[field],
      });
      onChanged(updated);
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      setError(err?.detail || err?.message || 'Не удалось изменить права');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button
          variant={user.can_be_master ? 'secondary' : 'outline'}
          size="sm"
          disabled={busy !== null}
          onClick={() => toggle('can_be_master')}
          title={user.can_be_master ? 'Отобрать права мастера' : 'Выдать права мастера'}
        >
          {busy === 'master' ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-1 h-4 w-4" />
          )}
          {user.can_be_master ? 'Мастер' : 'Сделать мастером'}
        </Button>

        <Button
          variant={user.is_admin ? 'secondary' : 'outline'}
          size="sm"
          // Снять с себя админку нельзя — бэкенд тоже это запрещает.
          disabled={busy !== null || (isSelf && user.is_admin)}
          onClick={() => toggle('is_admin')}
          title={
            isSelf && user.is_admin
              ? 'Нельзя снять права администратора с самого себя'
              : user.is_admin
                ? 'Отобрать права администратора'
                : 'Выдать права администратора'
          }
        >
          {busy === 'admin' ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Crown className="mr-1 h-4 w-4" />
          )}
          {user.is_admin ? 'Админ' : 'Сделать админом'}
        </Button>
      </div>
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </div>
  );
}
