'use client';

import { useCommonSessionWebSocket } from '@/app/services/hooks/useCommonSessionWebSocket';
import Link from 'next/link';

export function CampaignSessionBanner({ sessionId }: { sessionId: string }) {
  const { session } = useCommonSessionWebSocket(sessionId);
  const s = session as {
    launched_scenario_id?: string | null;
    launched_scenario_name?: string | null;
    campaign_id?: string | null;
    campaign_name?: string | null;
  } | null;

  if (s?.launched_scenario_id) {
    return (
      <div className="mx-4 mt-2 mb-0 rounded-md border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-100 flex flex-wrap gap-2 items-center">
        <span className="font-medium">{s.launched_scenario_name ?? 'Запущенный сценарий'}</span>
        {s.campaign_name ? (
          <span className="text-violet-200 text-xs">
            · {s.campaign_name}
            {(session as { campaign_step_index?: number; campaign_total_steps?: number })
              .campaign_step_index != null
              ? ` · эпизод ${(session as { campaign_step_index: number }).campaign_step_index + 1}${
                  (session as { campaign_total_steps?: number }).campaign_total_steps
                    ? `/${(session as { campaign_total_steps: number }).campaign_total_steps}`
                    : ''
                }`
              : ''}
          </span>
        ) : null}
        <Link
          href={`/scenarios/${s.launched_scenario_id}`}
          className="text-amber-300/90 underline text-xs"
        >
          Редактировать мир
        </Link>
        {s.campaign_id ? (
          <Link href={`/campaigns/${s.campaign_id}`} className="text-violet-300/90 underline text-xs">
            Кампания
          </Link>
        ) : null}
      </div>
    );
  }

  if (!s?.campaign_id) return null;

  return (
    <div className="mx-4 mt-2 mb-0 rounded-md border border-violet-700/50 bg-violet-950/40 px-3 py-2 text-sm text-violet-100 flex flex-wrap gap-2 items-center">
      <span className="font-medium">{s.campaign_name ?? 'Кампания'}</span>
      <Link href={`/campaigns/${s.campaign_id}`} className="text-violet-300/90 underline text-xs">
        Открыть
      </Link>
    </div>
  );
}
