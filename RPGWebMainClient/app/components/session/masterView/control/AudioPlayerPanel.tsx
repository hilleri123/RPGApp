// components/session/AudioPlayerPanel.tsx
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Square, SkipForward, Music2, Volume2, VolumeX, Clock, Trash2 } from 'lucide-react';
import { create } from 'zustand';
import type { AudioQueueEntry } from '@/app/services/types/audio';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';

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

// ── прогресс-бар ──────────────────────────────────────────────────────────────
function ProgressBar({
  audioRef,
  duration,
  isMaster,
  onSeek,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  duration: number | null;
  isMaster: boolean;
  onSeek?: (sec: number) => void;
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef<number | null>(null);

  // анимируем через requestAnimationFrame
  const tick = useCallback(() => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    rafRef.current = requestAnimationFrame(tick);
  }, [audioRef]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [tick]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const pct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMaster || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const sec = Math.max(0, Math.min(duration, ratio * duration));
    if (audioRef.current) audioRef.current.currentTime = sec;
    onSeek?.(sec);
  };

  return (
    <div className="space-y-1">
      <div
        className={[
          'relative h-1.5 rounded-full bg-gray-700 overflow-hidden',
          isMaster ? 'cursor-pointer' : 'cursor-default',
        ].join(' ')}
        onClick={handleClick}
      >
        {/* заполненная часть */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 transition-none"
          style={{ width: `${pct}%` }}
        />
        {/* бегунок — только у мастера */}
        {isMaster && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow"
            style={{ left: `calc(${pct}% - 5px)` }}
          />
        )}
      </div>

      <div className="flex justify-between text-xs text-gray-500 tabular-nums">
        <span>{fmt(currentTime)}</span>
        {duration != null && <span>{fmt(duration)}</span>}
      </div>
    </div>
  );
}

// ── компонент ─────────────────────────────────────────────────────────────────
interface Props { sessionId: string }

export function AudioPlayerPanel({ sessionId }: Props) {
  const {
    audio_queue,
    audio_player,
    isMaster,
    audioCommand,
    audioPlayEntry,
    setMasterVolume,
    syncPosition,
  } = useSessionWebSocket(sessionId);

  const { localVolume, muted, setLocalVolume, toggleMute } = useAudioPlayerStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const syncRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentEntryId = audio_player?.current_entry_id ?? null;
  const playing        = audio_player?.playing          ?? false;
  const masterVolume   = audio_player?.volume           ?? 1.0;
  const positionSec    = audio_player?.position_sec     ?? 0.0;
  const positionAt     = audio_player?.position_at      ?? null;

  const effectiveVolume = muted ? 0 : Math.min(1, masterVolume * localVolume);

  const currentEntry = (audio_queue ?? []).find((e) => e.id === currentEntryId) ?? null;
  const unplayed     = (audio_queue ?? []).filter((e) => !e.played);
  const nextEntry    = unplayed.find((e) => e.id !== currentEntryId);

  // ── инициализация ──────────────────────────────────────────────────────────
  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (syncRef.current) clearInterval(syncRef.current);
    };
  }, []);

  // ── смена трека ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (currentEntry) {
      el.src    = currentEntry.track_url;
      el.loop   = currentEntry.loop;
      el.volume = effectiveVolume;
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
  }, [currentEntryId]); // eslint-disable-line

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

  // ── мастер: sync позиции каждые 5 сек ─────────────────────────────────────
  useEffect(() => {
    if (!isMaster || !playing) {
      if (syncRef.current) { clearInterval(syncRef.current); syncRef.current = null; }
      return;
    }
    syncRef.current = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused)
        syncPosition(audioRef.current.currentTime);
    }, 5000);
    return () => { if (syncRef.current) { clearInterval(syncRef.current); syncRef.current = null; } };
  }, [playing, isMaster]); // eslint-disable-line

  if (!audio_queue?.length) return null;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-3 space-y-2.5 text-sm">

      {/* ── Текущий трек + управление ── */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Music2 className="w-4 h-4 shrink-0 text-indigo-400" />
            <span className="truncate font-medium text-gray-100">
              {currentEntry?.track_name ?? (
                <span className="font-normal text-gray-500">Не выбран</span>
              )}
            </span>
            {playing && <span className="shrink-0 text-xs text-indigo-400 animate-pulse">▶</span>}
          </div>
          {currentEntry && (
            <p className="pl-5 mt-0.5 truncate text-xs text-gray-500">
              {currentEntry.reason.exposure_name}
              {' · '}
              {currentEntry.reason.source_name}
              {currentEntry.reason.scene_name ? ` → ${currentEntry.reason.scene_name}` : ''}
            </p>
          )}
        </div>

        {/* кнопки только у мастера */}
        {isMaster && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => audioCommand(playing ? 'pause' : 'play')}
              disabled={!currentEntryId && unplayed.length === 0}
              className="rounded p-1.5 text-gray-300 hover:bg-indigo-500/20 hover:text-indigo-300
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label={playing ? 'Пауза' : 'Играть'}
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => audioCommand('stop')}
              disabled={!currentEntryId}
              className="rounded p-1.5 text-gray-300 hover:bg-red-500/15 hover:text-red-400
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Стоп"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={() => nextEntry && audioPlayEntry(nextEntry.id)}
              disabled={!nextEntry}
              className="rounded p-1.5 text-gray-300 hover:bg-gray-700
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Следующий"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Прогресс-бар ── */}
      {currentEntry && (
        <ProgressBar
          audioRef={audioRef}
          duration={currentEntry.track_duration ?? null}
          isMaster={isMaster}
          onSeek={isMaster ? syncPosition : undefined}
        />
      )}

      {/* ── Громкость ── */}
      <div className="space-y-1.5">
        {isMaster && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span className="w-14 shrink-0">Мастер</span>
            <input
              type="range" min={0} max={1} step={0.05}
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
              aria-label="Громкость мастера"
            />
            <span className="w-8 text-right tabular-nums">{Math.round(masterVolume * 100)}%</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <button onClick={toggleMute} aria-label={muted ? 'Включить' : 'Выключить'}>
            {muted
              ? <VolumeX className="w-3.5 h-3.5 text-red-400" />
              : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <span className="w-14 shrink-0">Локально</span>
          <input
            type="range" min={0} max={2} step={0.05}
            value={muted ? 0 : localVolume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setLocalVolume(v);
              if (v > 0 && muted) toggleMute();
            }}
            className="flex-1 accent-emerald-500"
            aria-label="Локальная громкость"
          />
          <span className="w-8 text-right tabular-nums">
            {muted ? '0%' : `${Math.round(localVolume * 100)}%`}
          </span>
        </div>
      </div>

      {/* ── Очередь (только мастер) ── */}
      {isMaster && (
        <div className="space-y-0.5 max-h-52 overflow-y-auto">
          <div className="flex items-center justify-between px-1 mb-1 text-xs text-gray-500">
            <span>Очередь ({audio_queue.length})</span>
            <button
              onClick={() => audioCommand('clear_queue')}
              className="flex items-center gap-1 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Очистить
            </button>
          </div>
          {audio_queue.map((entry) => (
            <QueueRow
              key={entry.id}
              entry={entry}
              isActive={entry.id === currentEntryId}
              isPlaying={playing && entry.id === currentEntryId}
              onPlay={() => audioPlayEntry(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── строка очереди ─────────────────────────────────────────────────────────────
function QueueRow({ entry, isActive, isPlaying, onPlay }: {
  entry: AudioQueueEntry;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  const time = new Date(entry.added_at).toLocaleTimeString('ru', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <button
      onClick={onPlay}
      className={[
        'w-full flex items-start gap-2 rounded px-2 py-1.5 text-left transition-colors',
        isActive
          ? 'bg-indigo-500/20 ring-1 ring-indigo-500/40'
          : entry.played
          ? 'opacity-40 hover:opacity-70 hover:bg-gray-800/40'
          : 'hover:bg-gray-800/60',
      ].join(' ')}
    >
      <Music2 className={['w-3.5 h-3.5 mt-0.5 shrink-0', isActive ? 'text-indigo-400' : 'text-gray-500'].join(' ')} />
      <div className="min-w-0 flex-1">
        <div className={['truncate', isActive ? 'text-indigo-300' : 'text-gray-200'].join(' ')}>
          {entry.track_name}
          {isPlaying && <span className="ml-1.5 text-xs text-indigo-400 animate-pulse">▶</span>}
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
          <Clock className="w-3 h-3 shrink-0" />
          <span className="shrink-0">{time}</span>
          <span className="truncate">
            · {entry.reason.exposure_name} · {entry.reason.source_name}
            {entry.reason.scene_name ? ` → ${entry.reason.scene_name}` : ''}
          </span>
        </div>
      </div>
      {entry.track_duration != null && (
        <span className="mt-0.5 shrink-0 text-xs text-gray-500">
          {Math.floor(entry.track_duration / 60)}:
          {String(Math.floor(entry.track_duration % 60)).padStart(2, '0')}
        </span>
      )}
    </button>
  );
}