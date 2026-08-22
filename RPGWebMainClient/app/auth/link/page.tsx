'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { authApiService } from '@/app/services/api/auth';
import { useAuth } from '@/app/services/hooks/useAuth';
import { safeReturnTo } from '@/app/lib/auth/routes';

function LinkLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const next = safeReturnTo(searchParams.get('next'), '/');
    let cancelled = false;

    void (async () => {
      // Уже залогинен — токен не тратим, идём в лобби/корень.
      try {
        await authApiService.getCurrentUser();
        if (!cancelled) {
          await refreshAuth();
          router.replace(next);
        }
        return;
      } catch {
        // нет сессии — пробуем одноразовую ссылку
      }

      if (!token) {
        if (!cancelled) setError('Ссылка устарела');
        return;
      }

      try {
        await authApiService.linkLogin(token);
        await refreshAuth();
        if (!cancelled) router.replace(next);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Ссылка устарела';
        setError(msg.includes('устарел') ? msg : 'Ссылка устарела');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router, refreshAuth]);

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
