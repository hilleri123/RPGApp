'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { authApiService } from '@/app/services/api/auth';
import { safeReturnTo } from '@/app/lib/auth/routes';

/**
 * Один вход на токен за загрузку страницы. Эффект может отработать дважды
 * (StrictMode, перерендер): второй прогон ждёт тот же промис, а не тратит
 * одноразовый токен повторно и не получает «Ссылка устарела».
 */
const linkLogins = new Map<string, Promise<void>>();

function loginOnce(token: string | null): Promise<void> {
  const key = token ?? '';
  let pending = linkLogins.get(key);
  if (!pending) {
    pending = (async () => {
      // Уже залогинен — токен не тратим.
      try {
        await authApiService.getCurrentUser();
        return;
      } catch {
        // нет сессии — пробуем одноразовую ссылку
      }
      if (!token) throw new Error('Ссылка устарела');
      await authApiService.linkLogin(token);
    })();
    linkLogins.set(key, pending);
  }
  return pending;
}

function LinkLoginInner() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const next = safeReturnTo(searchParams.get('next'), '/');
    let cancelled = false;

    loginOnce(token).then(
      () => {
        // Полная загрузка: AuthProvider поднимется заново уже с куками,
        // и /session/<id> откроется залогиненным.
        window.location.replace(next);
      },
      (e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Ссылка устарела';
        setError(msg.includes('устарел') ? msg : 'Ссылка устарела');
      },
    );

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-300 mb-4">{error}</p>
        <p className="text-sm text-gray-400">
          Получите новую ссылку командой /link в личке Telegram-бота.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
      <p>Вход в приложение…</p>
    </div>
  );
}

export default function LinkLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <LinkLoginInner />
    </Suspense>
  );
}
