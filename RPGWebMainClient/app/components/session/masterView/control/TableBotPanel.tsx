'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { tableApi, type TableParticipant, type TableState } from '@/app/services/api/table';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import type { Player } from '@/app/services/types/lobby';

function clock(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatWeight(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.max(bytes / 1024, 0).toFixed(0)} КБ`;
  return `${mb.toFixed(1)} МБ`;
}

function formatTalk(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  if (minutes <= 0) return `${rest} с`;
  return `${minutes} мин ${rest} с`;
}

function playerLabel(player: Player) {
  const person = player.name || player.user?.full_name || 'игрок';
  const character = player.character?.name;
  return character ? `${person} — ${character}` : person;
}

function bindValue(row: TableParticipant) {
  if (row.bind_kind === 'master') return 'master';
  if (row.bind_kind === 'observer' && row.observer_code) return `observer:${row.observer_code}`;
  if (row.character_id) return `character:${row.character_id}`;
  return '';
}

export function TableBotPanel({ sessionId }: { sessionId: string }) {
  const { session, observers: liveObservers } = useSessionWebSocket(sessionId);
  const observers = liveObservers ?? [];
  const players = (session?.players ?? []).filter((player) => player.character_id);
  const [roomUrl, setRoomUrl] = useState('https://peregovorka.mos.ru/room/');
  const [password, setPassword] = useState('');
  const [table, setTable] = useState<TableState | null>(null);
  const [runs, setRuns] = useState<TableState[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const waitingReport = useRef<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [next, history] = await Promise.all([
        tableApi.getTable(sessionId),
        tableApi.runs(sessionId),
      ]);
      setTable(next);
      setRuns(history);
      if (next?.room_url) setRoomUrl(next.room_url);
      if (waitingReport.current !== null && next?.test_report && next.test_report !== waitingReport.current) {
        waitingReport.current = null;
        setTesting(false);
      }
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось прочитать стол');
    }
  }, [sessionId]);

  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 3000);
    return () => clearInterval(timer);
  }, [reload]);

  async function start() {
    setBusy(true);
    setError('');
    try {
      const created = await tableApi.start(sessionId, roomUrl.trim(), password.trim());
      setTable(created);
      setSelectedId(created.id);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось войти в комнату');
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    setError('');
    try {
      await tableApi.stop(sessionId);
      await reload();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось остановить стол');
    } finally {
      setBusy(false);
    }
  }

  async function recap() {
    setBusy(true);
    setError('');
    try {
      const draft = await tableApi.recap(sessionId);
      setTable((current) => current ? { ...current, recap: draft } : current);
      setRuns((rows) => rows.map((row) => row.id === table?.id ? { ...row, recap: draft } : row));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось собрать черновик');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAuto(enabled: boolean) {
    setError('');
    setTable((row) => row ? { ...row, auto_connect: enabled } : row);
    try {
      const next = await tableApi.auto(sessionId, enabled, roomUrl.trim(), password.trim());
      setTable(next);
      if (enabled) setSelectedId(next.id);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось переключить автоматический вход');
      await reload();
    }
  }

  async function toggleMusic(enabled: boolean) {
    setError('');
    try {
      let current = table;
      if (!current) {
        current = await tableApi.start(sessionId, roomUrl.trim(), password.trim());
        setTable(current);
        setSelectedId(current.id);
      }
      await tableApi.music(sessionId, enabled);
      setTable((row) => row ? { ...row, music_enabled: enabled } : row);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось переключить музыку');
    }
  }

  async function testConnection() {
    setBusy(true);
    setError('');
    setTesting(true);
    waitingReport.current = table?.test_report ?? '';
    try {
      if (!table) {
        const created = await tableApi.start(sessionId, roomUrl.trim(), password.trim());
        setTable(created);
        setSelectedId(created.id);
      }
      await tableApi.test(sessionId);
    } catch (exc) {
      setTesting(false);
      setError(exc instanceof Error ? exc.message : 'Не удалось запросить тест');
    } finally {
      setBusy(false);
    }
  }

  const playersByCharacter = new Map(players.map((player) => [String(player.character_id), player]));
  const shown = runs.find((row) => row.id === selectedId) ?? runs[runs.length - 1] ?? table;

  function personName(row: TableParticipant) {
    const jitsi = row.display_name || row.jitsi_id || 'участник';
    const player = row.character_id ? playersByCharacter.get(String(row.character_id)) : undefined;
    const role = row.bind_label || (player ? playerLabel(player) : '');
    if (role && role !== jitsi) return `${jitsi} — ${role}`;
    return jitsi;
  }

  function patchParticipant(participantId: string, jitsiName: string, patch: Partial<TableParticipant>) {
    const samePerson = (item: TableParticipant) => (
      item.id === participantId || (jitsiName !== '' && item.display_name === jitsiName)
    );
    const apply = (row: TableState | null) => row ? {
      ...row,
      participants: row.participants.map((item) => (
        samePerson(item) ? { ...item, ...patch } : item
      )),
    } : row;
    setTable(apply);
    setRuns((rows) => rows.map((row) => apply(row) ?? row));
  }

  async function bind(participantId: string, value: string) {
    setError('');
    const kind: '' | 'character' | 'master' | 'observer' = value === 'master'
      ? 'master'
      : value.startsWith('observer:')
        ? 'observer'
        : value.startsWith('character:')
          ? 'character'
          : '';
    const characterId = kind === 'character' ? value.slice('character:'.length) : null;
    const observerCode = kind === 'observer' ? value.slice('observer:'.length) : null;
    const player = characterId ? playersByCharacter.get(characterId) : undefined;
    const bindLabel = kind === 'master'
      ? 'Мастер'
      : kind === 'observer' && observerCode
        ? `Наблюдатель ${observerCode}`
        : player?.character?.name || '';
    try {
      await tableApi.bind(sessionId, participantId, kind, characterId, observerCode);
      const person = shown?.participants.find((item) => item.id === participantId);
      patchParticipant(participantId, person?.display_name || '', {
        bind_kind: kind,
        character_id: characterId,
        observer_code: observerCode,
        bind_label: bindLabel,
      });
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось сопоставить участника');
    }
  }

  const names = new Map((shown?.participants ?? []).map((row) => [row.id, personName(row)]));
  const weightById = new Map((shown?.stats?.participants ?? []).map((row) => [row.participant_id, row]));

  return (
    <div className="space-y-4 text-sm text-gray-200">
      <div className="flex flex-col gap-2">
        <input
          className="rounded border border-gray-700 bg-transparent px-2 py-1"
          value={roomUrl}
          onChange={(event) => setRoomUrl(event.target.value)}
          placeholder="https://peregovorka.mos.ru/room/…"
          onBlur={() => {
            if (table?.auto_connect && roomUrl.trim() && roomUrl.trim() !== table.room_url) {
              void toggleAuto(true);
            }
          }}
        />
        <input
          className="rounded border border-gray-700 bg-transparent px-2 py-1"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Пароль комнаты, если он задан"
          type="password"
        />
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(table?.auto_connect)}
            onChange={(event) => void toggleAuto(event.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium text-white">Подключаться автоматически</span>
            <span className="block text-xs text-gray-400">Бот сам входит в комнату и возвращается, если связь оборвалась.</span>
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded bg-indigo-600 px-3 py-1 disabled:opacity-50" disabled={busy || Boolean(table?.auto_connect)} onClick={() => void start()}>
            Войти
          </button>
          <button type="button" className="rounded border border-gray-700 px-3 py-1 disabled:opacity-50" disabled={busy || !table || Boolean(table?.auto_connect)} onClick={() => void stop()}>
            Выйти
          </button>
          <button type="button" className="rounded border border-gray-700 px-3 py-1 disabled:opacity-50" disabled={busy || !roomUrl.trim()} onClick={() => void testConnection()}>
            Тест
          </button>
          <button type="button" className="rounded border border-gray-700 px-3 py-1 disabled:opacity-50" disabled={busy || !table} onClick={() => void recap()}>
            Черновик истории
          </button>
        </div>
      </div>
      <p className="text-gray-400">
        {table
          ? `${table.status_label}${table.status_detail ? ` — ${table.status_detail}` : ''}`
          : 'Не подключён'}
      </p>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={Boolean(table?.music_enabled)}
          onChange={(event) => void toggleMusic(event.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-white">Музыка в Jitsi</span>
          <span className="block text-xs text-gray-400">Стол включает микрофон, и комната слышит очередь сессии.</span>
        </span>
      </label>
      {testing && <p className="text-gray-400">Бот пишет статус в чат комнаты…</p>}
      {table?.test_report && (
        <p className="whitespace-pre-wrap rounded border border-gray-800 bg-gray-900/60 p-2 text-gray-300">{table.test_report}</p>
      )}
      <div>
        <div className="text-sm font-medium text-white">Запись</div>
        {runs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {runs.map((run, index) => (
              <button
                key={run.id}
                type="button"
                className={`rounded px-2 py-1 ${shown?.id === run.id ? 'bg-indigo-600 text-white' : 'border border-gray-700 text-gray-300'}`}
                onClick={() => setSelectedId(run.id)}
              >
                Запуск {index + 1}
              </button>
            ))}
          </div>
        )}
        <p className="text-gray-400">Всего {formatWeight(shown?.stats?.bytes ?? 0)}</p>
        {(shown?.music?.length ?? 0) > 0 && (
          <ul className="mt-1 space-y-1 text-gray-400">
            {shown?.music?.map((row, index) => (
              <li key={`${row.path}-${index}`}>
                {row.path}: {formatTalk(row.position_start)} – {formatTalk(row.position_end)}
              </li>
            ))}
          </ul>
        )}
        {(shown?.participants.length ?? 0) > 0 && (
          <ul className="mt-2 space-y-2">
            {shown?.participants.map((row) => {
              const stat = weightById.get(row.id);
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="text-white">{row.display_name || 'участник'}</span>
                    <span className="text-gray-400">
                      {': '}{formatWeight(stat?.bytes ?? 0)}, говорил {formatTalk(stat?.seconds ?? 0)}
                    </span>
                  </span>
                  <select
                    className="rounded border border-gray-700 bg-gray-950 px-2 py-1"
                    value={bindValue(row)}
                    onChange={(event) => void bind(row.id, event.target.value)}
                  >
                    <option value="">Не сопоставлен</option>
                    <option value="master">Мастер{session?.master?.full_name ? ` — ${session.master.full_name}` : ''}</option>
                    {players.map((player) => (
                      <option key={player.id} value={`character:${player.character_id}`}>
                        {playerLabel(player)}
                      </option>
                    ))}
                    {observers.map((observer) => (
                      <option key={observer.code} value={`observer:${observer.code}`}>
                        Наблюдатель {observer.code}
                      </option>
                    ))}
                    {row.bind_kind === 'observer' && row.observer_code && !observers.some((observer) => observer.code === row.observer_code) && (
                      <option value={`observer:${row.observer_code}`}>
                        Наблюдатель {row.observer_code}
                      </option>
                    )}
                  </select>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {error && <p className="text-red-400">{error}</p>}
      {!!shown?.utterances.length && (
        <ul className="max-h-64 space-y-1 overflow-auto">
          {shown.utterances.map((line) => (
            <li key={line.id}>
              <span className="text-gray-500">{clock(line.real_started_at)}</span>
              {line.game_time ? <span className="text-gray-500"> · {line.game_time.replace('T', ' ')}</span> : null}
              {' '}
              <span className="text-gray-300">{names.get(line.participant_id ?? '') || 'участник'}:</span>
              {' '}
              {line.text}
            </li>
          ))}
        </ul>
      )}
      {shown?.recap && (
        <div className="whitespace-pre-wrap border-t border-gray-800 pt-2">
          {shown.recap.text}
          {shown.recap.images?.map((image, index) => (
            <div key={index} className="mt-2">
              {image.url ? <img src={image.url} alt="" className="max-h-48 rounded" /> : <p className="text-gray-500">{image.prompt}</p>}
              {image.error && <p className="text-gray-500">{image.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
