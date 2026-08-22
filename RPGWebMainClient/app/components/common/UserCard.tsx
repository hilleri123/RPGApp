'use client';

import { User } from '@/app/services/types/auth';
import { getStatusColor } from '@/app/services/types/auth';

interface UserCardProps {
  user: User;
  color?: string; // ожидаем "#rrggbb"
}

export const UserCard: React.FC<UserCardProps> = ({ user, color }) => {
  return (
    <div className="relative w-16 h-16">
      {/* Рамка/обводка вокруг аватарки */}
      <div
        className="w-16 h-16 rounded-full border-2 border-transparent overflow-hidden"
        style={color ? { borderColor: color } : undefined}
      >
        <img
          // src={user.avatar}
          alt={user.full_name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Индикатор статуса (как был) */}
      <div
        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800 ${getStatusColor(user)}`}
      />
    </div>
  );
};
