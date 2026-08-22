'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Home,
  Gamepad2,
  Users,
  BookOpen,
  Menu,
  X,
  Music2,
  Layers,
  Sparkles,
  Package,
  Mail,
  ChevronDown,
  Crown,
} from 'lucide-react';
import { useAuth } from '@/app/services/hooks/useAuth';

interface SimpleNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const masterMenuItems: SimpleNavItem[] = [
  { href: '/scenarios', label: 'Сценарии', icon: BookOpen },
  { href: '/entity-packs', label: 'Паки', icon: Package },
  { href: '/name-packs', label: 'Имена', icon: Sparkles },
  { href: '/campaigns', label: 'Кампании', icon: Layers },
  { href: '/launched-scenarios', label: 'Запущенные', icon: Gamepad2 },
  { href: '/audio', label: 'Аудио', icon: Music2 },
];

const groupsNavItem: SimpleNavItem = {
  href: '/access_groups',
  label: 'Группы',
  icon: Users,
};

const publicNavItems: SimpleNavItem[] = [
  { href: '/', label: 'Главная', icon: Home },
  { href: '/contacts', label: 'Контакты', icon: Mail },
];

function linkClass(active: boolean, extra = '') {
  return `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    active
      ? 'bg-gray-700 text-white'
      : 'text-gray-300 hover:text-white hover:bg-gray-700'
  } ${extra}`;
}

export default function Navigation() {
  const { state, logout } = useAuth();
  const { user } = state;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const canMaster = Boolean(user && (user.can_be_master || user.is_admin));

  const isActiveLink = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const masterSectionActive = masterMenuItems.some((item) => isActiveLink(item.href));

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const renderSimpleLink = (item: SimpleNavItem, onNavigate?: () => void, iconSize = 'w-4 h-4') => {
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={linkClass(isActiveLink(item.href), onNavigate ? 'w-full' : '')}
      >
        <Icon className={iconSize} />
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <nav className="hidden md:flex items-center space-x-2 shrink-0">
        {publicNavItems.map((item) => renderSimpleLink(item))}

        {canMaster && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={linkClass(masterSectionActive, 'outline-none data-[state=open]:bg-gray-700')}
                >
                  <Crown className="w-4 h-4 text-amber-400/90" />
                  Мастеру
                  <ChevronDown className="w-4 h-4 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[12rem] border-gray-700 bg-gray-800 text-gray-100"
              >
                {masterMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActiveLink(item.href);
                  return (
                    <DropdownMenuItem key={item.href} asChild className="focus:bg-gray-700 focus:text-white">
                      <Link
                        href={item.href}
                        className={`flex cursor-pointer items-center gap-2 ${active ? 'text-white' : ''}`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {renderSimpleLink(groupsNavItem)}
          </>
        )}
      </nav>

      <div className="md:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-gray-300 hover:text-white"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={closeMobileMenu} />

          <div className="fixed top-0 right-0 h-full w-72 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Меню</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeMobileMenu}
                className="text-gray-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-2">
              {publicNavItems.map((item) => renderSimpleLink(item, closeMobileMenu, 'w-5 h-5'))}

              {canMaster && (
                <div className="pt-2 mt-2 border-t border-gray-700 space-y-1">
                  <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-400/90 flex items-center gap-2">
                    <Crown className="w-3.5 h-3.5" />
                    Мастеру
                  </p>
                  {masterMenuItems.map((item) =>
                    renderSimpleLink(item, closeMobileMenu, 'w-5 h-5')
                  )}
                  <div className="pt-1">{renderSimpleLink(groupsNavItem, closeMobileMenu, 'w-5 h-5')}</div>
                </div>
              )}

              {user && (
                <div className="border-t border-gray-700 pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      closeMobileMenu();
                    }}
                    className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-red-400 hover:text-red-300 hover:bg-gray-700 w-full text-left"
                  >
                    Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
