'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Music2, Play } from 'lucide-react';

import type { AudioTrack } from '@/app/services/types/audio';
import { audioApiService } from '@/app/services/api/audio';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { AudioSearchFilters } from '@/app/components/audio/AudioSearchFilters';
import { AudioTrackTagBadges } from '@/app/components/audio/AudioTrackTagBadges';
import { filterAudioTracks } from '@/app/components/audio/audioTags';
import { AudioPlayerPanel } from '../masterView/control/AudioPlayerPanel';

function fmtDuration(sec?: number | null) {
  if (sec == null) return null;
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

export function SessionAudioTab({ sessionId }: { sessionId: string }) {
  const { enqueueAudioTrack } = useSessionWebSocket(sessionId);
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [allTracks, setAllTracks] = useState<AudioTrack[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      void audioApiService
        .getTracks({
          search: query.trim() || undefined,
          limit: 500,
        })
        .then((data) => {
          if (!cancelled) setAllTracks(data);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const tracks = useMemo(
    () => filterAudioTracks(allTracks, '', activeTags),
    [allTracks, activeTags],
  );

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <AudioSearchFilters
        query={query}
        onQueryChange={setQuery}
        activeTags={activeTags}
        onActiveTagsChange={setActiveTags}
        placeholder="Поиск по всей библиотеке..."
      />

      <div className="text-xs text-gray-500 shrink-0 flex items-center gap-2">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        {tracks.length} из {allTracks.length} треков
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
        {!loading && tracks.length === 0 ? (
          <div className="text-sm text-gray-500 py-4">Ничего не найдено.</div>
        ) : (
          tracks.map((track: AudioTrack) => (
            <button
              key={track.id}
              type="button"
              onClick={() => enqueueAudioTrack(track.id)}
              className="w-full text-left rounded border border-gray-700/80 bg-gray-900/60 px-2.5 py-2 hover:bg-gray-800/80 transition-colors"
            >
              <div className="flex items-start gap-2">
                <Music2 className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-gray-100">{track.name}</span>
                    {fmtDuration(track.duration) ? (
                      <span className="text-xs text-gray-500 shrink-0">{fmtDuration(track.duration)}</span>
                    ) : null}
                  </div>
                  {track.description ? (
                    <div className="text-xs text-gray-500 truncate mt-0.5">{track.description}</div>
                  ) : null}
                  <AudioTrackTagBadges tags={track.tags} />
                </div>
                <Play className="w-3.5 h-3.5 shrink-0 text-indigo-300 mt-1" />
              </div>
            </button>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-gray-800 pt-2">
        <AudioPlayerPanel sessionId={sessionId} />
      </div>
    </div>
  );
}
