'use client';

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dice6, 
  LogOut, 
  User as UserIcon,
  Crown,
  Music2,
  Eye
} from "lucide-react";
import Navigation from './Navigation';
import { useAuth } from '@/app/services/hooks/useAuth';

interface HeaderProps {
  section?: string | null;
  /** When set, guest «Вход» opens this instead of navigating to /login. */
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
}

export default function Header({ section, onLoginClick, onRegisterClick }: HeaderProps) {
  const { state, logout } = useAuth();
  const { user, isAuthenticated } = state;
  const showProfile = isAuthenticated && user;

  return (
    <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0 grow basis-0"
          >
            <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Dice6 className="w-5 h-5 text-white" />
            </div>
            {/* Шапка фиксированной высоты, поэтому длинное название раздела режем, а не переносим. */}
            <div className="flex flex-col min-w-0">
              <span className="text-xl font-bold text-white truncate" title={section || 'RPG Master'}>
                {section || 'RPG Master'}
              </span>
              <span className="text-xs text-gray-400 -mt-1">Game Manager</span>
            </div>
          </Link>
          <Navigation />

          <div className="flex items-center gap-4">
            {showProfile ? (
              <>
                <Link href="/me" className="hidden sm:flex flex-row items-center gap-3">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {user.full_name}
                      </span>
                      {user.is_admin && (
                        <Crown className="w-4 h-4 text-yellow-500" title="Администратор" />
                      )}
                      {!user.is_admin && user.can_be_master && (
                        <Crown className="w-4 h-4 text-amber-500/80" title="Мастер" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge 
                        variant="outline" 
                        className="text-xs border-green-600 text-green-400"
                      >
                        Онлайн
                      </Badge>
                    </div>
                  </div>

                  <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center border-2 border-gray-600">
                    {user.img_url ? (
                      <img
                        src={user.img_url}
                        alt={user.full_name || "Аватар пользователя"}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <UserIcon className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-gray-300 hover:text-red-400 hover:bg-gray-700 hidden sm:flex"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Выйти
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/observer">
                  <Button variant="ghost" size="sm" className="text-violet-300/80 hover:text-violet-200 hidden sm:flex">
                    <Eye className="w-4 h-4 mr-1.5" />
                    Наблюдение
                  </Button>
                </Link>
                {onLoginClick ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300 hover:text-white"
                    onClick={onLoginClick}
                  >
                    Вход
                  </Button>
                ) : (
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white">
                      Вход
                    </Button>
                  </Link>
                )}
                {onRegisterClick ? (
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={onRegisterClick}>
                    Регистрация
                  </Button>
                ) : (
                  <Link href="/login?register=1">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                      Регистрация
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}