'use client';

import React, { useMemo, useState } from 'react';
import { Music2, X } from 'lucide-react';
import type { AudioTrack, ExposureAudioLink } from '@/app/services/types/audio';
import { useSceneExposures } from './SceneExposuresContext';
import { EntityPickerList, type EntityCardRenderProps } from './EntityPickerList';
import type { IdName } from './SceneExposuresContext';
import { AudioSearchFilters } from '@/app/components/audio/AudioSearchFilters';
import { AudioTrackTagBadges } from '@/app/components/audio/AudioTrackTagBadges';
import { audioTrackSearchText, filterAudioTracks } from '@/app/components/audio/audioTags';

function linkToIdName(link: ExposureAudioLink): IdName {
  return {
    id: String(link.audio_track_id),
    name: link.audio_track?.name ?? String(link.audio_track_id),
    _link: link,
  };
}

export function AudioPickerPanel(props: { audioOptions?: AudioTrack[] | null }) {
  const { readOnly, selected, addAudio, removeAudio } = useSceneExposures();
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const audioById = useMemo(() => {
    const m: Record<string, AudioTrack> = {};
    for (const t of props.audioOptions ?? []) m[String(t.id)] = t;
    return m;
  }, [props.audioOptions]);

  const addedIds = useMemo(
    () => new Set((selected?.audio_tracks ?? []).map((a) => String(a.audio_track_id))),
    [selected?.audio_tracks],
  );

  const filteredTracks = useMemo(
    () => filterAudioTracks(props.audioOptions ?? [], query, activeTags),
    [props.audioOptions, query, activeTags],
  );

  const searchOptions = useMemo<IdName[]>(
    () =>
      filteredTracks
        .filter((t) => !addedIds.has(String(t.id)))
        .map((t) => ({ id: t.id, name: t.name })),
    [filteredTracks, addedIds],
  );

  const selectedAsIdName = useMemo<IdName[]>(
    () => (selected?.audio_tracks ?? []).map(linkToIdName),
    [selected?.audio_tracks],
  );

  if (!selected) return null;

  return (
    <EntityPickerList
      title="Аудио"
      readOnly={readOnly}
      searchOptions={searchOptions}
      addPlaceholder="Добавить аудиодорожку..."
      selected={selectedAsIdName}
      comboHeader={
        <AudioSearchFilters
          query={query}
          onQueryChange={setQuery}
          activeTags={activeTags}
          onActiveTagsChange={setActiveTags}
        />
      }
      comboFilterItem={(item, q) => {
        const track = audioById[item.id];
        if (!track) return item.name.toLowerCase().includes(q);
        return audioTrackSearchText(track).includes(q);
      }}
      onPick={(id) => {
        if (!id) return;
        const track = audioById[String(id)];
        if (track) addAudio(track);
      }}
      onRemove={removeAudio}
      renderCard={({ item, readOnly: ro, onRemove }: EntityCardRenderProps) => {
        const link = (item as any)._link as ExposureAudioLink | undefined;
        const name = item.name;
        const tags = link?.audio_track?.tags;

        return (
          <div className="flex items-center justify-between gap-3 rounded border border-gray-700 bg-gray-800/60 px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Music2 className="w-4 h-4 shrink-0 text-indigo-400" />
                <span className="truncate text-sm text-gray-100">{name}</span>
                {link?.audio_track?.duration ? (
                  <span className="text-xs text-gray-500 shrink-0">
                    {Math.floor(link.audio_track.duration / 60)}:
                    {String(Math.floor(link.audio_track.duration % 60)).padStart(2, '0')}
                  </span>
                ) : null}
              </div>
              <AudioTrackTagBadges tags={tags} />
            </div>
            {!ro && (
              <button
                type="button"
                onClick={() => onRemove?.(item.id)}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-500/15 hover:text-red-400 transition-colors"
                aria-label="Удалить аудио"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      }}
      getKey={(item) => String(item.id)}
    />
  );
}
