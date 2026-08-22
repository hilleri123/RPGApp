'use client';

import { useParams } from 'next/navigation';
import { SessionFeedsTabs } from '@/app/components/session/common/SessionFeedsTabs';

export default function CountersLogPanel() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  return (
    <div className="h-full min-h-0 flex flex-col p-4">
      <SessionFeedsTabs sessionId={sessionId} />
    </div>
  );
}
