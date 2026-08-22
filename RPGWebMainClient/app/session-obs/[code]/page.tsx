'use client';

import { ObserverView } from '@/app/components/session-obs/ObserverView';
import { ObserverWsProvider } from '@/app/services/providers/ObserverWsProvider';
import { useParams } from 'next/navigation';

export default function SessionObserverByCodePage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  return (
    <ObserverWsProvider code={code}>
      <ObserverView />
    </ObserverWsProvider>
  );
}
