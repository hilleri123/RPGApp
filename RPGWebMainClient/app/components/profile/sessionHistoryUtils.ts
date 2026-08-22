import type { CampaignSessionHistoryItem } from '@/app/services/types/sessionDispatch';

export interface ProfileSessionStats {
  total: number;
  completed: number;
  active: number;
  asMaster: number;
  asPlayer: number;
  hoursPlayed: number;
}

function sessionDurationHours(item: CampaignSessionHistoryItem): number | null {
  if (!item.created_at) return null;
  const start = new Date(item.created_at).getTime();
  const end = item.finished_at
    ? new Date(item.finished_at).getTime()
    : item.is_active
      ? Date.now()
      : null;
  if (end == null || end <= start) return null;
  return (end - start) / (1000 * 60 * 60);
}

export function computeProfileSessionStats(
  history: CampaignSessionHistoryItem[],
): ProfileSessionStats {
  const completed = history.filter((h) => !h.is_active);
  const hoursPlayed = history.reduce((sum, item) => {
    const hours = sessionDurationHours(item);
    return hours != null ? sum + hours : sum;
  }, 0);

  return {
    total: history.length,
    completed: completed.length,
    active: history.filter((h) => h.is_active).length,
    asMaster: history.filter((h) => h.role === 'master').length,
    asPlayer: history.filter((h) => h.role === 'player').length,
    hoursPlayed: Math.round(hoursPlayed),
  };
}

export function formatSessionDuration(item: CampaignSessionHistoryItem): string | null {
  const hours = sessionDurationHours(item);
  if (hours == null) return null;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} мин`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
}

export function formatHistoryDate(item: CampaignSessionHistoryItem): string {
  const raw = item.finished_at ?? item.created_at;
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
