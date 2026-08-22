'use client';

import { Badge } from '@/components/ui/badge';
import type { User } from '@/app/services/types/auth';

export function UserRoleBadges({ user }: { user: Pick<User, 'is_admin' | 'can_be_master'> }) {
  if (!user.is_admin && !user.can_be_master) return null;

  return (
    <span className="inline-flex items-center gap-1 ml-2">
      {user.is_admin ? (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-900/60 text-amber-200 border-amber-700/50">
          Админ
        </Badge>
      ) : null}
      {user.can_be_master ? (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-violet-900/60 text-violet-200 border-violet-700/50">
          Мастер
        </Badge>
      ) : null}
    </span>
  );
}

export function userDisplayName(user: Pick<User, 'full_name' | 'email' | 'telegram_id'>): string {
  return user.full_name?.trim() || user.email?.trim() || String(user.telegram_id ?? 'Без имени');
}
