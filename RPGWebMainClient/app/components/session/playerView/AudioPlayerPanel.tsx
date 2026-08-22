// components/session/AudioPlayerPanel.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { Music2, Volume2, VolumeX } from 'lucide-react';
import { create } from 'zustand';
import { usePlayerSessionWebSocket } from '@/app/services/hooks/usePlayerSessionWebSocket';

// ── локальный стор ────────────────────────────────────────────────────────────
type AudioPlayerStore = {
  localVolume: number;
  muted: boolean;
  setLocalVolume: (v: number) => void;
  toggleMute: () => void;
};

export const useAudioPlayerStore = create<AudioPlayerStore>((set) => ({
  localVolume: 1.0,
  muted: false,
  setLocalVolume: (localVolume) => set({ localVolume }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
}));

// ── компонент ─────────────────────────────────────────────────────────────────
interface Props {
  sessionId: string;
  compact?: boolean;
}

export function AudioPlayerPanel({ sessionId, compact = false }: Props) {
  const { audio_queue, audio_player, settings } = usePlayerSessionWebSocket(sessionId);
  const { localVolume, muted, setLocalVolume, toggleMute } = useAudioPlayerStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playing      = audio_player?.playing          ?? false;
  const masterVolume = audio_player?.volume           ?? 1.0;
  const positionSec  = audio_player?.position_sec     ?? 0.0;
  const positionAt   = audio_player?.position_at      ?? null;
  const currentId    = audio_player?.current_entry_id ?? null;

  const currentEntry = (audio_queue ?? []).find((e) => e.id === currentId) ?? null;

  // итоговая громкость
  const effectiveVolume = muted ? 0 : Math.min(1, masterVolume * localVolume);

  // ── инициализация ──────────────────────────────────────────────────────────
  useEffect(() => {
    audioRef.current = new Audio();
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, []);

  // ── смена трека ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (currentEntry) {
      el.src    = currentEntry.track_url;
      el.loop   = currentEntry.loop;
      el.volume = effectiveVolume;

      // восстанавливаем позицию
      if (positionAt && playing) {
        const elapsed = (Date.now() - new Date(positionAt).getTime()) / 1000;
        el.currentTime = Math.max(0, positionSec + elapsed);
      } else {
        el.currentTime = positionSec;
      }

      if (playing) el.play().catch(() => {});
    } else {
      el.pause();
      el.src = '';
    }
  }, [currentId]); // eslint-disable-line

  // ── play / pause ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !currentEntry) return;
    if (playing) {
      if (positionAt) {
        const elapsed = (Date.now() - new Date(positionAt).getTime()) / 1000;
        el.currentTime = Math.max(0, positionSec + elapsed);
      }
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [playing]); // eslint-disable-line

  // ── громкость ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = effectiveVolume;
  }, [effectiveVolume]);

  // ── нет трека → ничего не рендерим ────────────────────────────────────────
  if (!currentEntry || !playing) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm">
      {/* иконка + название */}
      <Music2 className="w-4 h-4 shrink-0 text-indigo-400" />
      {!settings?.hide_audio_name && (
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-gray-100 flex items-center gap-1.5">
            {currentEntry.track_name}
            <span className="text-xs text-indigo-400 animate-pulse shrink-0">▶</span>
          </div>
          <p className="truncate text-xs text-gray-500 mt-0.5">
            {currentEntry.reason.exposure_name}
            {' · '}
            {currentEntry.reason.source_name}
            {currentEntry.reason.scene_name ? ` → ${currentEntry.reason.scene_name}` : ''}
          </p>
        </div>
      )}

      {/* кнопка mute */}
      <button
        onClick={toggleMute}
        className={[
          'shrink-0 rounded p-1.5 transition-colors',
          muted
            ? 'text-red-400 hover:bg-red-500/15'
            : 'text-gray-400 hover:bg-gray-700',
        ].join(' ')}
        aria-label={muted ? 'Включить звук' : 'Выключить звук'}
      >
        {muted
          ? <VolumeX className="w-4 h-4" />
          : <Volume2 className="w-4 h-4" />}
      </button>

      {/* слайдер локальной громкости */}
      <input
        type="range" min={0} max={2} step={0.05}
        value={muted ? 0 : localVolume}
        onChange={(e) => {
          const v = Number(e.target.value);
          setLocalVolume(v);
          if (v > 0 && muted) toggleMute(); // снимаем mute при движении слайдера вверх
        }}
        className="w-20 accent-emerald-500"
        aria-label="Громкость"
      />

      <span className="w-8 shrink-0 text-right text-xs text-gray-500 tabular-nums">
        {muted ? '0%' : `${Math.round(localVolume * 100)}%`}
      </span>
    </div>
  );
}