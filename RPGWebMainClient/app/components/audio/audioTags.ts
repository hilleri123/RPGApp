import type { AudioTrack } from '@/app/services/types/audio';

export const AUDIO_TRACK_TAGS = [
  { id: 'atmosphere', label: 'Атмосфера' },
  { id: 'background', label: 'Фон' },
  { id: 'tension', label: 'Напряжение' },
  { id: 'combat', label: 'Бой' },
  { id: 'mystery', label: 'Тайна' },
  { id: 'horror', label: 'Ужас' },
  { id: 'victory', label: 'Победа' },
  { id: 'social', label: 'Социальное' },
  { id: 'travel', label: 'Путешествие' },
  { id: 'magic', label: 'Магия' },
] as const;

export type AudioTrackTagId = (typeof AUDIO_TRACK_TAGS)[number]['id'];

const TAG_LABEL_BY_ID = Object.fromEntries(
  AUDIO_TRACK_TAGS.map((t) => [t.id, t.label]),
) as Record<string, string>;

export function getAudioTagLabel(tagId: string): string {
  return TAG_LABEL_BY_ID[tagId] ?? tagId;
}

function norm(s: string): string {
  return (s ?? '').toLowerCase().trim();
}

export function audioTrackSearchText(track: AudioTrack): string {
  const tags = (track.tags ?? []).map((t) => `${t} ${getAudioTagLabel(t)}`).join(' ');
  return norm([track.name, track.description ?? '', tags].join(' '));
}

export function filterAudioTracks(
  tracks: AudioTrack[],
  query: string,
  activeTagIds: string[] = [],
): AudioTrack[] {
  const nq = norm(query);
  const tagSet = new Set(activeTagIds.map((t) => norm(t)));

  return (tracks ?? []).filter((track) => {
    if (tagSet.size > 0) {
      const trackTags = new Set((track.tags ?? []).map((t) => norm(t)));
      const hasAllTags = [...tagSet].every((t) => trackTags.has(t));
      if (!hasAllTags) return false;
    }
    if (!nq) return true;
    return audioTrackSearchText(track).includes(nq);
  });
}
