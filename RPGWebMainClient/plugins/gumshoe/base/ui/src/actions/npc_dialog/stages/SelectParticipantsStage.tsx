// plugins/gumshoe/npc_dialog/stages/SelectParticipantsStage.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { Users, Bot } from 'lucide-react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function SelectParticipantsStage({ user_id, action, onSubmit, setSubmitEnabled }: any) {
  const scene      = action?.scene?.scene ?? {};
  const characters: any[] = scene?.characters ?? [];
  const npcs: any[]       = scene?.npcs ?? [];
  const isGm = asStr(action?.participants?.gmUserId) === asStr(user_id);

  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [selectedNpcIds,  setSelectedNpcIds]  = useState<string[]>([]);

  useEffect(() => {
    setSubmitEnabled(selectedCharIds.length > 0 && selectedNpcIds.length > 0);
  }, [selectedCharIds, selectedNpcIds]);

  if (!isGm) {
    return (
      <div className="rounded border p-3 text-sm text-white/60">
        Мастер выбирает участников разговора…
      </div>
    );
  }

  const toggleChar = (id: string) =>
    setSelectedCharIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const toggleNpc = (id: string) =>
    setSelectedNpcIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <div className="font-medium flex items-center gap-2">
        <Users className="w-4 h-4 text-purple-400" />
        Выбор участников разговора
      </div>

      {/* Персонажи */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-white/50 uppercase tracking-wide flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> Персонажи
        </div>
        {characters.length === 0 && (
          <div className="text-sm text-white/40">Нет персонажей в сцене</div>
        )}
        {characters.map((ch: any) => {
          const active = selectedCharIds.includes(String(ch.id));
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => toggleChar(String(ch.id))}
              className={`text-left rounded border px-3 py-2 text-sm transition-colors
                ${active
                  ? 'border-purple-400 bg-purple-500/10 text-purple-200'
                  : 'border-white/20 hover:border-white/40 text-white/80'}`}
            >
              <div className="font-semibold">{asStr(ch.name, 'Безымянный')}</div>
              <div className="text-xs text-white/40 mt-0.5">
                {Object.entries(ch?.data?.skills ?? {})
                  .filter(([, v]: any) => v > 0)
                  .slice(0, 5)
                  .map(([k, v]: any) => `${k}: ${v}`)
                  .join(' · ')}
              </div>
            </button>
          );
        })}
      </div>

      {/* НПС */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-white/50 uppercase tracking-wide flex items-center gap-1">
          <Bot className="w-3.5 h-3.5" /> НПС
        </div>
        {npcs.length === 0 && (
          <div className="text-sm text-white/40">Нет НПС в сцене</div>
        )}
        {npcs.map((npc: any) => {
          const active = selectedNpcIds.includes(String(npc.id));
          return (
            <button
              key={npc.id}
              type="button"
              onClick={() => toggleNpc(String(npc.id))}
              className={`text-left rounded border px-3 py-2 text-sm transition-colors
                ${active
                  ? 'border-amber-400 bg-amber-500/10 text-amber-200'
                  : 'border-white/20 hover:border-white/40 text-white/80'}`}
            >
              <div className="font-semibold">{asStr(npc.name, 'Безымянный НПС')}</div>
              {npc.description_for_master && (
                <div className="text-xs text-white/40 mt-0.5 line-clamp-2">
                  {npc.description_for_master}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedCharIds.length > 0 && selectedNpcIds.length > 0 && (
        <div className="rounded border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-sm text-purple-200">
          {selectedCharIds.length} перс. → {selectedNpcIds.length} НПС
        </div>
      )}

      <button
        type="button"
        disabled={selectedCharIds.length === 0 || selectedNpcIds.length === 0}
        onClick={() => onSubmit({ character_ids: selectedCharIds, npc_ids: selectedNpcIds })}
        className={`rounded border px-3 py-2 text-sm font-semibold transition-colors
          ${selectedCharIds.length > 0 && selectedNpcIds.length > 0
            ? 'border-purple-400/60 text-purple-300 hover:bg-purple-500/10'
            : 'border-white/10 text-white/25 cursor-not-allowed'}`}
      >
        Начать разговор
      </button>
    </div>
  );
}