// components/session/feeds/SessionFeedsTabs.tsx
'use client';

import React from 'react';
import { LogFeed } from './feeds/LogFeed';
import { NotificationFeed } from './feeds/NotificationFeed';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileText, Bell, Music2, Inbox } from 'lucide-react';
import { useCommonSessionWebSocket } from '@/app/services/hooks/useCommonSessionWebSocket';
import { ActionFeed } from './feeds/ActionFeed';
import { SessionMessagesPanel } from './feeds/SessionMessagesPanel';
import { SessionAudioTab } from './SessionAudioTab';
import { countUnread } from './sessionMessages';
import { cn } from '@/lib/utils';
import { useUrlTab } from '@/app/services/hooks/useUrlTab';

type JournalTab = 'logs' | 'actions' | 'notifications' | 'messages' | 'audio';

const JOURNAL_TABS_BASE: readonly JournalTab[] = ['actions', 'messages', 'logs', 'notifications'];
const JOURNAL_TABS_WITH_AUDIO: readonly JournalTab[] = [...JOURNAL_TABS_BASE, 'audio'];

export function SessionFeedsTabs({
  sessionId,
  fillAvailable = false,
}: {
  sessionId: string;
  fillAvailable?: boolean;
}) {
  const { session, audio_queue, isMaster, dispatches, selfPlayer } = useCommonSessionWebSocket(sessionId) as any;
  const allowedTabs = isMaster ? JOURNAL_TABS_WITH_AUDIO : JOURNAL_TABS_BASE;
  const [activeTab, setActiveTab] = useUrlTab<JournalTab>(allowedTabs, 'actions', { paramName: 'sub' });

  const selfUserId = isMaster
    ? String(session?.master?.id ?? '')
    : String(selfPlayer?.user?.id ?? '');
  const messagesUnread = countUnread(dispatches ?? [], selfUserId);

  if (!session) {
    return (
      <div className={fillAvailable ? "flex-1 min-h-0 overflow-y-auto bg-gray-950 rounded p-2 text-xs text-gray-500" : "overflow-y-auto max-h-80 bg-gray-950 rounded p-2 text-xs text-gray-500"}>
        Данные сессии ещё не загружены
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-white min-h-0">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full h-full flex flex-col min-h-0">
        <TabsList className={cn("mb-2 shrink-0 h-auto min-h-10", fillAvailable && "grid grid-cols-2 sm:grid-cols-4 gap-1 w-full")}>
          <TabsTrigger value="actions" className="flex items-center gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" />
            Действия
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-1.5 text-xs">
            <Inbox className="w-3.5 h-3.5" />
            Сообщения
            {messagesUnread > 0 && (
              <span className="ml-1 text-[10px] bg-violet-700 rounded-full px-1 py-0 leading-none">
                {messagesUnread}
              </span>
            )}
          </TabsTrigger>
          {isMaster && (
            <TabsTrigger value="audio" className="flex items-center gap-1.5 text-xs">
              <Music2 className="w-3.5 h-3.5" />
              Аудио
              {audio_queue.filter((e: any) => !e.played).length > 0 && (
                <span className="ml-1 text-[10px] bg-indigo-600 rounded-full px-1 py-0 leading-none">
                  {audio_queue.filter((e: any) => !e.played).length}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="logs" className="flex items-center gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" />
            Логи
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5 text-xs">
            <Bell className="w-3.5 h-3.5" />
            События
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="flex-1 min-h-0 overflow-hidden mt-0">
          <ActionFeed fillAvailable={fillAvailable} />
        </TabsContent>

        <TabsContent value="messages" className="flex-1 min-h-0 overflow-hidden mt-0">
          <SessionMessagesPanel sessionId={sessionId} variant={isMaster ? 'master' : 'player'} />
        </TabsContent>

        {isMaster && (
          <TabsContent value="audio" className="flex-1 min-h-0 overflow-hidden mt-0">
            <SessionAudioTab sessionId={sessionId} />
          </TabsContent>
        )}

        <TabsContent value="logs" className="flex-1 min-h-0 overflow-hidden mt-0">
          <LogFeed sessionId={sessionId} fillAvailable={fillAvailable} />
        </TabsContent>

        <TabsContent value="notifications" className="flex-1 min-h-0 overflow-hidden mt-0">
          <NotificationFeed sessionId={sessionId} fillAvailable={fillAvailable} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
