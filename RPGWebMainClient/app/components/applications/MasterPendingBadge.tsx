// app/components/application/MasterPendingBadge.tsx
// Кнопка для профиля мастера — показывает кол-во pending заявок
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { masterApplicationApiService } from '@/app/services/api/application';

export function MasterPendingBadge() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    // грузим только submitted + in_review
    Promise.all([
      masterApplicationApiService.getList({ status: 'submitted', limit: 200 }),
      masterApplicationApiService.getList({ status: 'in_review', limit: 200 }),
    ]).then(([s, r]) => setCount(s.length + r.length)).catch(() => {});
  }, []);

  return (
    <Button
      variant="outline"
      size="sm"
      className="relative border-gray-600 text-gray-300 hover:text-white gap-2"
      onClick={() => router.push('/master/applications')}
    >
      <Inbox className="w-4 h-4" />
      Заявки
      {count !== null && count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-yellow-500 text-black text-[10px] font-bold flex items-center justify-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Button>
  );
}