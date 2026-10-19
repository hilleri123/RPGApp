'use client';

import { useCallback, useEffect, useState } from 'react';

import { tableApi, type TableState } from '@/app/services/api/table';

type Approach = {
  id: string;
  name: string;
  created_at?: string;
  runs: TableState[];
};

function clock(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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

export function ScenarioTableArchive({ scenarioId }: { scenarioId: string }) {
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [approachId, setApproachId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [packing, setPacking] = useState(false);

  const reload = useCallback(async () => {
    try {
      const archive = await tableApi.archive(scenarioId);
      setApproaches(archive.approaches);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось прочитать стол');
    }
  }, [scenarioId]);

  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 3000);
    return () => clearInterval(timer);
  }, [reload]);

  const approach = approaches.find((row) => row.id === approachId) ?? approaches[approaches.length - 1];
  const run = approach?.runs.find((row) => row.id === runId) ?? approach?.runs[approach.runs.length - 1];
  const names = new Map((run?.participants ?? []).map((row) => {
    const jitsi = row.display_name || row.jitsi_id;
    const role = row.bind_label;
    return [row.id, role && role !== jitsi ? `${jitsi} — ${role}` : (jitsi || 'участник')];
  }));
  const weightById = new Map((run?.stats?.participants ?? []).map((row) => [row.participant_id, row]));

  async function downloadPack() {
    if (!approach) return;
    setPacking(true);
    setError('');
    try {
      const response = await fetch(`/api/scenarios/${scenarioId}/approaches/${approach.id}/pack`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Не удалось собрать папку');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const encoded = /filename\*=UTF-8''([^;]+)/.exec(response.headers.get('Content-Disposition') || '');
      link.href = url;
      link.download = encoded ? decodeURIComponent(encoded[1]) : 'approach.zip';
      link.click();
      URL.revokeObjectURL(url);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Не удалось собрать папку');
    } finally {
      setPacking(false);
    }
  }

  if (!approaches.length) {
    return <p className="text-sm text-gray-400">Запусков стола ещё нет.</p>;
  }

  return (
    <div className="space-y-4 text-sm text-gray-200">
      <div className="flex flex-wrap gap-1">
        {approaches.map((row) => (
          <button
            key={row.id}
            type="button"
            className={`rounded px-2 py-1 ${approach?.id === row.id ? 'bg-indigo-600 text-white' : 'border border-gray-700 text-gray-300'}`}
            onClick={() => {
              setApproachId(row.id);
              setRunId(null);
            }}
          >
            {row.name || 'Подход'}{row.created_at ? ` · ${clock(row.created_at)}` : ''}
          </button>
        ))}
      </div>
      {approach && (
        <button
          type="button"
          className="rounded border border-gray-700 px-3 py-1 disabled:opacity-50"
          disabled={packing}
          onClick={() => void downloadPack()}
        >
          {packing ? 'Собираю…' : 'Скачать для рассказа'}
        </button>
      )}
      {(approach?.runs.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1">
          {approach?.runs.map((row, index) => (
            <button
              key={row.id}
              type="button"
              className={`rounded px-2 py-1 ${run?.id === row.id ? 'bg-indigo-600 text-white' : 'border border-gray-700 text-gray-300'}`}
              onClick={() => setRunId(row.id)}
            >
              Запуск {index + 1}
            </button>
          ))}
        </div>
      )}
      {run && (
        <>
          <p className="text-gray-400">
            {run.status_label}
            {run.status_detail ? ` — ${run.status_detail}` : ''}
            {' · '}
            {formatWeight(run.stats?.bytes ?? 0)}
          </p>
          {(run.music?.length ?? 0) > 0 && (
            <ul className="space-y-1 text-gray-400">
              {run.music?.map((row, index) => (
                <li key={`${row.path}-${index}`}>
                  {row.path}: {formatTalk(row.position_start)} – {formatTalk(row.position_end)}
                </li>
              ))}
            </ul>
          )}
          <ul className="space-y-1">
            {run.participants.map((row) => {
              const stat = weightById.get(row.id);
              return (
                <li key={row.id}>
                  {names.get(row.id)}: {formatWeight(stat?.bytes ?? 0)}, говорил {formatTalk(stat?.seconds ?? 0)}
                </li>
              );
            })}
          </ul>
          {!!run.utterances.length && (
            <ul className="max-h-96 space-y-1 overflow-auto">
              {run.utterances.map((line) => (
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
          {run.recap && (
            <div className="whitespace-pre-wrap border-t border-gray-800 pt-2">
              {run.recap.text}
            </div>
          )}
        </>
      )}
      {error && <p className="text-red-400">{error}</p>}
    </div>
  );
}
