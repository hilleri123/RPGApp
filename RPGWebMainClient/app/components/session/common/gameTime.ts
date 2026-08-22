export function parseGameTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatGameTimeIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export function formatGameTimeLabel(value: string | null | undefined): string {
  const d = parseGameTime(value);
  if (!d) return 'Время не задано';
  return d.toLocaleString('ru', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatGameTimeDelta(sceneMs: number, sessionMs: number): {
  label: string;
  tone: 'ahead' | 'behind' | 'equal';
} | null {
  const diffMs = sceneMs - sessionMs;
  if (Math.abs(diffMs) < 60_000) {
    return { label: 'совпадает с сессией', tone: 'equal' };
  }

  const ahead = diffMs > 0;
  const abs = Math.abs(diffMs);
  const totalMinutes = Math.round(abs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}д`);
  if (hours) parts.push(`${hours}ч`);
  if (minutes || !parts.length) parts.push(`${minutes}м`);

  return {
    label: `${ahead ? '+' : '−'}${parts.join(' ')} от сессии`,
    tone: ahead ? 'ahead' : 'behind',
  };
}

export const GAME_TIME_QUICK_SHIFTS = [
  { label: '-1д', minutes: -24 * 60 },
  { label: '-1ч', minutes: -60 },
  { label: '-30м', minutes: -30 },
  { label: '+30м', minutes: 30 },
  { label: '+1ч', minutes: 60 },
  { label: '+1д', minutes: 24 * 60 },
] as const;
