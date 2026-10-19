'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { tableApi, type LobbyTable } from '@/app/services/api/table';

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

export function LobbyJitsiCard({ lobbyId }: { lobbyId: string }) {
  const [roomUrl, setRoomUrl] = useState('https://peregovorka.mos.ru/room/');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<LobbyTable | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordDirty = useRef(false);
  const urlDirty = useRef(false);
  const waitingReport = useRef<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await tableApi.lobbyTable(lobbyId);
      setState(next);
      if (!urlDirty.current && next.room_url) setRoomUrl(next.room_url);
      const report = next.table?.test_report;
      if (waitingReport.current !== null && report && report !== waitingReport.current) {
        waitingReport.current = null;
      }
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось прочитать стол');
    }
  }, [lobbyId]);

  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 3000);
    return () => clearInterval(timer);
  }, [reload]);

  function passwordToSend() {
    return passwordDirty.current ? password : null;
  }

  async function enter() {
    setBusy(true);
    setError('');
    try {
      const next = await tableApi.lobbyStart(lobbyId, roomUrl.trim(), passwordToSend(), true);
      setState(next);
      passwordDirty.current = false;
      urlDirty.current = false;
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось войти в комнату');
    } finally {
      setBusy(false);
    }
  }

  async function remember() {
    if (!/\/room\/[^/?#]+/.test(roomUrl.trim())) return;
    try {
      const next = await tableApi.lobbyStart(
        lobbyId,
        roomUrl.trim(),
        passwordToSend(),
        Boolean(state?.auto_connect),
      );
      setState(next);
      passwordDirty.current = false;
      urlDirty.current = false;
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось сохранить ссылку');
    }
  }

  async function stop() {
    setBusy(true);
    setError('');
    try {
      setState(await tableApi.lobbyStop(lobbyId));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось выйти');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAuto(enabled: boolean) {
    setError('');
    setState((current) => current ? { ...current, auto_connect: enabled } : current);
    try {
      setState(await tableApi.lobbyAuto(lobbyId, enabled));
      urlDirty.current = false;
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось переключить автоматический вход');
      await reload();
    }
  }

  async function toggleMusic(enabled: boolean) {
    setError('');
    setState((current) => current ? { ...current, music_enabled: enabled } : current);
    try {
      await tableApi.lobbyMusic(lobbyId, enabled);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось переключить музыку');
    }
  }

  async function testConnection() {
    setBusy(true);
    setError('');
    waitingReport.current = state?.table?.test_report ?? '';
    try {
      await tableApi.lobbyTest(lobbyId);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось запросить тест');
    } finally {
      setBusy(false);
    }
  }

  const table = state?.table;
  const weightById = new Map((table?.stats?.participants ?? []).map((row) => [row.participant_id, row]));

  return (
    <section className="rounded-lg border border-gray-800 bg-gray-950 p-4 space-y-3 text-sm text-gray-200">
      <div>
        <h2 className="text-base font-medium text-white">Jitsi</h2>
        <p className="text-xs text-gray-400">
          Ссылка и музыка перейдут в подход. Здесь запись только для проверки: в сессию и в сценарий она не попадает.
        </p>
      </div>
      <input
        className="w-full rounded border border-gray-700 bg-transparent px-2 py-1"
        value={roomUrl}
        onChange={(event) => {
          urlDirty.current = true;
          setRoomUrl(event.target.value);
        }}
        onBlur={() => void remember()}
        placeholder="https://peregovorka.mos.ru/room/…"
      />
      <input
        className="w-full rounded border border-gray-700 bg-transparent px-2 py-1"
        value={password}
        onChange={(event) => {
          passwordDirty.current = true;
          setPassword(event.target.value);
        }}
        placeholder={state?.has_password ? 'Пароль сохранён' : 'Пароль комнаты, если он задан'}
        type="password"
      />
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={Boolean(state?.auto_connect)}
          onChange={(event) => void toggleAuto(event.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-white">Подключаться автоматически</span>
          <span className="block text-xs text-gray-400">Бот сам входит в комнату. Галка переходит в подход.</span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded bg-indigo-600 px-3 py-1 disabled:opacity-50" disabled={busy || Boolean(state?.auto_connect)} onClick={() => void enter()}>
          Войти
        </button>
        <button type="button" className="rounded border border-gray-700 px-3 py-1 disabled:opacity-50" disabled={busy || !table || Boolean(state?.auto_connect)} onClick={() => void stop()}>
          Выйти
        </button>
        <button type="button" className="rounded border border-gray-700 px-3 py-1 disabled:opacity-50" disabled={busy || !table} onClick={() => void testConnection()}>
          Тест
        </button>
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
          checked={Boolean(state?.music_enabled)}
          onChange={(event) => void toggleMusic(event.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-white">Музыка в Jitsi</span>
          <span className="block text-xs text-gray-400">В подходе очередь сессии пойдёт в комнату, а не в браузер.</span>
        </span>
      </label>
      {table?.test_report && (
        <p className="whitespace-pre-wrap rounded border border-gray-800 bg-gray-900/60 p-2 text-gray-300">{table.test_report}</p>
      )}
      <div>
        <div className="text-sm font-medium text-white">Проверка записи</div>
        <p className="text-gray-400">Всего {formatWeight(table?.stats?.bytes ?? 0)}</p>
        <ul className="mt-2 space-y-1">
          {(table?.participants ?? []).map((row) => {
            const stat = weightById.get(row.id);
            return (
              <li key={row.id}>
                {row.display_name || 'участник'}: {formatWeight(stat?.bytes ?? 0)}, говорил {formatTalk(stat?.seconds ?? 0)}
              </li>
            );
          })}
        </ul>
      </div>
      {error && <p className="text-red-400">{error}</p>}
    </section>
  );
}
