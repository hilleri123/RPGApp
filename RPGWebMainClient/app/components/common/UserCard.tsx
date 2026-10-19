'use client';

import { useState } from 'react';
import { User, getStatusColor } from '@/app/services/types/auth';

interface UserCardProps {
  user: User;
  color?: string; // ожидаем "#rrggbb"
  /** Онлайн по живому соединению. Без него остаётся старый признак is_active аккаунта. */
  online?: boolean;
}

export const UserCard: React.FC<UserCardProps> = ({ user, color, online }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const avatarUrl = user.img_url || user.icon_url;
  const initial = (user.full_name || user.email || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="relative w-16 h-16">
      {/* Рамка/обводка вокруг аватарки */}
      <div
        className="w-16 h-16 rounded-full border-2 border-transparent overflow-hidden bg-gray-600 flex items-center justify-center text-white text-lg font-semibold"
        style={color ? { borderColor: color } : undefined}
      >
        {avatarUrl && failedSrc !== avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user.full_name || 'Аватар'}
            className="w-full h-full object-cover"
            onError={() => setFailedSrc(avatarUrl)}
          />
        ) : (
          <span aria-hidden>{initial}</span>
        )}
      </div>

      {/* Индикатор статуса (как был) */}
      <div
        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800 ${online === undefined ? getStatusColor(user) : online ? 'bg-green-500' : 'bg-gray-400'}`}
      />
    </div>
  );
};
