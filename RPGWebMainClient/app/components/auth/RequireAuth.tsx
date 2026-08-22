'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/app/services/hooks/useAuth';
import { safeReturnTo } from '@/app/lib/auth/routes';

type RequireAuthProps = {
  children: React.ReactNode;
};

export function RequireAuth({ children }: RequireAuthProps) {
  const { state } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [returnPath, setReturnPath] = useState(pathname);

  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    setReturnPath(pathname + search);
  }, [pathname]);

  useEffect(() => {
    if (!state.loading && !state.isAuthenticated) {
      const next = encodeURIComponent(safeReturnTo(returnPath, '/'));
      router.replace(`/login?next=${next}`);
    }
  }, [state.loading, state.isAuthenticated, router, returnPath]);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-white">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
