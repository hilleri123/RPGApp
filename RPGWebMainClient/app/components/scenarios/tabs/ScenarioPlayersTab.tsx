'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useScenario } from '@/app/components/scenarios/ScenarioContext';
import { launchedScenariosApi } from '@/app/services/api/launchedScenarios';
import type { LaunchedPlayerRow, LaunchedPlayers } from '@/app/services/api/launchedScenarios';

export function ScenarioPlayersTab() {
  const { scenario, canEditEntities } = useScenario();
  const [data, setData] = useState<LaunchedPlayers | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scenario?.id) return;
    setError(null);
    try {
      setData(await launchedScenariosApi.listPlayers(scenario.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить игроков');
    }
  }, [scenario?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (row: LaunchedPlayerRow, patch: Partial<Pick<LaunchedPlayerRow, 'color' | 'character_id'>>) => {
    if (!scenario?.id || !canEditEntities) return;
    const next = { ...row, ...patch };
    setData((current) => current && ({
      ...current,
      players: current.players.map((item) => (item.user_id === row.user_id ? next : item)),
    }));
    setSavingId(row.user_id);
    setError(null);
    try {
      await launchedScenariosApi.assignPlayer(scenario.id, row.user_id, {
        character_id: next.character_id,
        color: next.color,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
      void load();
    } finally {
      setSavingId(null);
    }
  };

  if (!data) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4 py-4">
      <div>
        <h2 className="text-2xl font-bold text-white">Игроки</h2>
        <p className="mt-1 text-sm text-gray-400">
          Кто уже играл в этом сценарии, чей сейчас персонаж и каким цветом он придёт в лобби.
        </p>
      </div>
      {error ? <div className="text-sm text-red-400">{error}</div> : null}
      {data.players.length === 0 ? (
        <div className="text-sm text-gray-500">Пока никто не играл.</div>
      ) : (
        <div className="space-y-2">
          {data.players.map((row) => (
            <div
              key={row.user_id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-gray-800 bg-gray-950/60 px-3 py-2"
            >
              <span className="min-w-40 flex-1 text-sm text-white">{row.name}</span>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                Цвет
                <input
                  type="color"
                  value={row.color || '#ffffff'}
                  disabled={!canEditEntities || savingId === row.user_id}
                  onChange={(event) => void save(row, { color: event.target.value })}
                  className="h-8 w-10 cursor-pointer bg-transparent"
                />
              </label>
              <select
                value={row.character_id ?? ''}
                disabled={!canEditEntities || savingId === row.user_id}
                onChange={(event) => void save(row, { character_id: event.target.value || null })}
                className="h-9 min-w-52 rounded-md border border-gray-700 bg-gray-900 px-2 text-sm text-white"
              >
                <option value="">Без персонажа</option>
                {data.characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
