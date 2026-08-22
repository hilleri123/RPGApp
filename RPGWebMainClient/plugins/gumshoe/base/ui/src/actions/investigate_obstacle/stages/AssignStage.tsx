// stages/AssignStage.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { UserSearch, Map } from 'lucide-react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function AssignStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const scene       = action?.scene?.scene ?? {};
  const characters: any[] = scene?.characters ?? [];
  const obstacles: any[]  = scene?.obstacles ?? [];
  const isGm = asStr(action?.participants?.gmUserId) === asStr(user_id);

  const [selectedCharId, setSelectedCharId]         = useState<string>('');
  const [selectedObstacleId, setSelectedObstacleId] = useState<string>('');

  // активируем Submit только когда выбраны оба
  useEffect(() => {
    setSubmitEnabled(!!selectedCharId && !!selectedObstacleId);
  }, [selectedCharId, selectedObstacleId]);

  if (!isGm) {
    return (
      <div className="rounded border p-3 text-sm text-white/60">
        Мастер назначает персонажа и препятствие для расследования…
      </div>
    );
  }

  const handleSubmit = () => {
    if (!selectedCharId || !selectedObstacleId) return;
    onSubmit({ character_id: selectedCharId, obstacle_id: selectedObstacleId });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <div className="font-medium">Назначить расследование</div>

      {/* Выбор персонажа */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-white/50 uppercase tracking-wide flex items-center gap-1">
          <UserSearch className="w-3.5 h-3.5" /> Кто расследует
        </div>
        <div className="flex flex-col gap-1.5">
          {characters.map((ch: any) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => setSelectedCharId(ch.id)}
              className={`
                text-left rounded border px-3 py-2 text-sm transition-colors
                ${selectedCharId === ch.id
                  ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                  : 'border-white/20 hover:border-white/40 text-white/80'}
              `}
            >
              <div className="font-semibold">{asStr(ch.name, 'Безымянный')}</div>
              <div className="text-xs text-white/40 mt-0.5">
                {Object.entries(ch?.data?.skills ?? {})
                  .filter(([, v]: any) => v > 0)
                  .slice(0, 4)
                  .map(([k, v]: any) => `${k}: ${v}`)
                  .join(' · ')}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Выбор препятствия */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-white/50 uppercase tracking-wide flex items-center gap-1">
          <Map className="w-3.5 h-3.5" /> Что расследовать
        </div>
        <div className="flex flex-col gap-1.5">
          {obstacles.map((o: any) => {
            const od = o?.data ?? {};

            // подсвечиваем, есть ли у выбранного персонажа подходящий навык
            const selChar    = characters.find((c: any) => c.id === selectedCharId);
            const charSkills = selChar?.data?.skills ?? {};
            const hasSkill   = (od.investigative_skills ?? []).some(
              (s: string) => (charSkills[s] ?? 0) >= 1
            );

            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelectedObstacleId(o.id)}
                className={`
                  text-left rounded border px-3 py-2 text-sm transition-colors
                  ${selectedObstacleId === o.id
                    ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                    : 'border-white/20 hover:border-white/40 text-white/80'}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{asStr(o.name, 'Препятствие')}</span>
                  {selectedCharId && (
                    <span className={`text-xs ${hasSkill ? 'text-green-400' : 'text-red-400/70'}`}>
                      {hasSkill ? '✓ есть навык' : '✗ нет навыка'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/40 mt-0.5">
                  Навыки: {(od.investigative_skills ?? []).join(', ') || '—'}
                </div>
                <div className="text-xs text-white/30 mt-0.5">
                  Улик: {(od.spends ?? []).length}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Итог + кнопка */}
      {selectedCharId && selectedObstacleId && (
        <div className="rounded border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm text-blue-200">
          {asStr(characters.find((c: any) => c.id === selectedCharId)?.name, '—')}
          {' '}→{' '}
          {asStr(obstacles.find((o: any) => o.id === selectedObstacleId)?.name, '—')}
        </div>
      )}

      <button
        type="button"
        disabled={!selectedCharId || !selectedObstacleId}
        onClick={handleSubmit}
        className={`
          rounded border px-3 py-2 text-sm font-semibold transition-colors
          ${selectedCharId && selectedObstacleId
            ? 'border-blue-400/60 text-blue-300 hover:bg-blue-500/10'
            : 'border-white/10 text-white/25 cursor-not-allowed'}
        `}
      >
        Назначить расследование
      </button>
    </div>
  );
}
