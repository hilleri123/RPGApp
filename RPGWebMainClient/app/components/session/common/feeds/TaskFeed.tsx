'use client';

import { useMemo, useState } from 'react';
import { useCommonSessionWebSocket } from '@/app/services/hooks/useCommonSessionWebSocket';
import { SessionDispatch } from '@/app/services/types/sessionDispatch';
import { NoteShownModal } from '../notifications/NoteShownModal';
import { NoteShownNotification } from '@/app/services/types/session.notification';
import { BaseFeedRow } from '@/app/components/common/BaseFeedRow';
import { Clock, CheckCircle, Circle } from 'lucide-react';

interface Props {
  sessionId: string;
}

function getTaskOrder(tags: string[]): number {
  if (tags.includes('pending')) return 0;
  if (tags.includes('completed')) return 2;
  return 1;
}

function toNotif(d: SessionDispatch): NoteShownNotification {
  return {
    id: d.id,
    dt: d.sent_at,
    notif_type: 'note_shown',
    initiator_id: d.sender_id,
    recipients: d.recipient_user_ids,
    readed_by: [],
    note: d.note,
  };
}

const GROUP_CONFIG = [
  { key: 'pending', label: 'В процессе', cls: 'text-yellow-400', icon: <Clock className="w-3.5 h-3.5" />, rowCls: 'border-l-2 border-yellow-500/50 bg-yellow-500/5', badgeCls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', badgeText: 'в процессе' },
  { key: 'none', label: 'Активные', cls: 'text-gray-300', icon: <Circle className="w-3.5 h-3.5" />, rowCls: 'border-l-2 border-gray-600', badgeCls: null, badgeText: null },
  { key: 'completed', label: 'Выполненные', cls: 'text-green-400', icon: <CheckCircle className="w-3.5 h-3.5" />, rowCls: 'border-l-2 border-green-500/50 bg-green-500/5 opacity-70', badgeCls: 'bg-green-500/20 text-green-300 border-green-500/40', badgeText: 'выполнено' },
] as const;

export function TaskFeed({ sessionId }: Props) {
  const { session, dispatches, changeNoteStatus } = useCommonSessionWebSocket(sessionId) as any;
  const [active, setActive] = useState<SessionDispatch | null>(null);

  const taskItems = useMemo(() => {
    return ((dispatches ?? []) as SessionDispatch[])
      .filter((d) => Array.isArray(d.note?.tags) && d.note.tags.includes('task'))
      .sort((a, b) => getTaskOrder(a.note.tags ?? []) - getTaskOrder(b.note.tags ?? []));
  }, [dispatches]);

  if (!session) return null;

  return (
    <>
      <div className="overflow-y-auto max-h-80 bg-gray-950 rounded p-2 space-y-1 text-sm" style={{ minHeight: 120 }}>
        {taskItems.length === 0 && (
          <div className="text-xs text-gray-500 italic px-2 py-1">Заданий пока нет</div>
        )}
        {GROUP_CONFIG.map(({ key, label, cls, icon, rowCls, badgeCls, badgeText }) => {
          const group = taskItems.filter((d) => {
            const tags = d.note?.tags ?? [];
            if (key === 'pending') return tags.includes('pending');
            if (key === 'completed') return tags.includes('completed');
            return !tags.includes('pending') && !tags.includes('completed');
          });
          if (group.length === 0) return null;
          return (
            <div key={key} className="mb-4">
              <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide px-1 mb-1.5 ${cls}`}>
                {icon}
                {label}
                <span className="text-gray-600 font-normal normal-case">({group.length})</span>
              </div>
              <div className="space-y-1">
                {group.map((d) => (
                  <BaseFeedRow key={d.id} id={d.id} dt={d.sent_at}>
                    <button type="button" className={`text-left w-full rounded px-2 py-1.5 transition-colors hover:bg-gray-800 ${rowCls}`} onClick={() => setActive(d)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-white ${key === 'completed' ? 'line-through text-gray-400' : ''}`}>{d.note?.name ?? 'Задание'}</span>
                        {badgeCls && badgeText ? <span className={`text-xs px-1.5 py-0.5 rounded-full border ${badgeCls}`}>{badgeText}</span> : null}
                      </div>
                    </button>
                  </BaseFeedRow>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {active ? (
        <NoteShownModal
          open
          onClose={() => setActive(null)}
          notif={toNotif(active)}
          sessionId={sessionId}
          initiatorName={active.sender_name ?? ''}
        />
      ) : null}
    </>
  );
}
