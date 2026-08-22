'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { CampaignSessionHistoryItem } from '@/app/services/types/sessionDispatch';
import { formatHistoryDate, formatSessionDuration } from './sessionHistoryUtils';

interface SessionHistoryListProps {
  items: CampaignSessionHistoryItem[];
  loading?: boolean;
  emptyText?: string;
  maxHeightClass?: string;
}

export function SessionHistoryList({
  items,
  loading = false,
  emptyText = 'История пуста',
  maxHeightClass = 'max-h-96',
}: SessionHistoryListProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-4">
        <Loader2 className="w-5 h-5 animate-spin" />
        Загрузка истории...
      </div>
    );
  }

  if (!items.length) {
    return <div className="text-gray-500 py-2">{emptyText}</div>;
  }

  return (
    <ul className={`space-y-2 overflow-y-auto ${maxHeightClass}`}>
      {items.map((h) => {
        const duration = formatSessionDuration(h);
        return (
          <li key={h.session_id} className="bg-gray-700/60 rounded-lg p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white truncate">{h.session_name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {h.campaign_name ? `${h.campaign_name} · ` : ''}
                  {h.role === 'master' ? 'мастер' : 'игрок'}
                  {h.step_index != null && h.total_steps
                    ? ` · шаг ${h.step_index + 1}/${h.total_steps}`
                    : ''}
                </div>
                <div className="text-xs text-gray-500 mt-1">{formatHistoryDate(h)}</div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                {h.is_active ? (
                  <Badge variant="outline" className="text-[10px] border-green-600 text-green-400">
                    активна
                  </Badge>
                ) : null}
                {duration ? (
                  <span className="text-blue-400 text-xs">{duration}</span>
                ) : null}
              </div>
            </div>
            {h.is_active ? (
              <Link
                href={`/session/${h.session_id}`}
                className="text-blue-400 text-xs hover:underline mt-2 inline-block"
              >
                Перейти в сессию
              </Link>
            ) : null}
            {h.campaign_id ? (
              <Link
                href={`/campaigns/${h.campaign_id}`}
                className="text-violet-400 text-xs hover:underline mt-1 inline-block"
              >
                Кампания
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
