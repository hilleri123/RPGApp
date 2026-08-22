'use client';

import Link from 'next/link';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/app/components/layout/Header';
import { useAuth } from '@/app/services/hooks/useAuth';

type Requirement = 'auth' | 'master' | 'admin';

const MESSAGES: Record<Requirement, { title: string; text: string }> = {
  auth: {
    title: 'Нужно войти',
    text: 'Этот раздел доступен только участникам. Войдите под своей учётной записью.',
  },
  master: {
    title: 'Нужны права мастера',
    text: 'Раздел для ведущих игру. Права мастера выдаёт администратор.',
  },
  admin: {
    title: 'Нужны права администратора',
    text: 'Раздел закрыт: здесь настраивают доступ и роли остальных участников.',
  },
};

/** Экран отказа. Прячет содержимое раздела и объясняет, чего не хватает. */
export function AccessDenied({ require: requirement }: { require: Requirement }) {
  const { title, text } = MESSAGES[requirement];
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section="Нет доступа" />
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-amber-400" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-gray-400">{text}</p>
        <div className="flex justify-center gap-3">
          <Link href="/">
            <Button variant="secondary">На главную</Button>
          </Link>
          {requirement === 'auth' ? (
            <Link href="/login">
              <Button>Войти</Button>
            </Link>
          ) : (
            <Link href="/contacts">
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                Связаться
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Возвращает готовый экран, если прав не хватает, и null, если можно рисовать раздел.
 * Пока профиль загружается, отдаёт спиннер — иначе на миг мелькает отказ.
 */
export function useAccessGate(requirement: Requirement): React.ReactElement | null {
  const { state } = useAuth();
  const { user, loading } = state;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) return <AccessDenied require="auth" />;
  if (requirement === 'admin' && !user.is_admin) return <AccessDenied require="admin" />;
  if (requirement === 'master' && !(user.can_be_master || user.is_admin)) {
    return <AccessDenied require="master" />;
  }
  return null;
}
