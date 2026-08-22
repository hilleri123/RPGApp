// plugins/gumshoe/npc_dialog/stages/DialogResultStage.tsx
'use client';
import React, { useEffect } from 'react';
import { CheckCircle, Coins } from 'lucide-react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function DialogResultStage({ user_id, action, onSubmit, setSubmitEnabled }: any) {
  const wf    = action?.workflow ?? {};
  const ctx   = wf?.context ?? {};
  const entry = ctx?.entry ?? {};
  const isDone = wf?.stageKey === 'completed';
  const isGm   = asStr(action?.participants?.gmUserId) === asStr(user_id);

  const scene      = action?.scene?.scene ?? {};
  const characters: any[] = scene?.characters ?? [];
  const npcs: any[]       = scene?.npcs ?? [];

  const spendRecords: any[] = (entry?.spend_records ?? []).filter((r: any) => r.confirmed);

  useEffect(() => {
    if (isGm && !isDone) setSubmitEnabled(true);
    else setSubmitEnabled(false);
  }, [isGm, isDone]);

  // Итого по навыкам и персонажам
  const spentByCharSkill: Record<string, Record<string, number>> = {};
  for (const r of spendRecords) {
    if (!spentByCharSkill[r.character_id]) spentByCharSkill[r.character_id] = {};
    spentByCharSkill[r.character_id][r.skill_name] =
      (spentByCharSkill[r.character_id][r.skill_name] ?? 0) + r.cost;
  }

  const participantNpcs  = npcs.filter((n: any) => (entry.npc_ids ?? []).includes(String(n.id)));
  const participantChars = characters.filter((c: any) => (entry.character_ids ?? []).includes(String(c.id)));

  const totalSpent = spendRecords.reduce((s: number, r: any) => s + r.cost, 0);

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <div className="font-medium flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-400" />
        {isDone ? 'Разговор завершён' : 'Итог разговора'}
      </div>

      {/* Участники */}
      <div className="flex flex-col gap-1 text-sm">
        <div className="text-xs text-white/50 uppercase tracking-wide mb-1">Участники</div>
        <div className="text-white/70">
          Персонажи:{' '}
          {participantChars.map((c: any) => asStr(c.name, '—')).join(', ') || '—'}
        </div>
        <div className="text-white/70">
          НПС:{' '}
          {participantNpcs.map((n: any) => asStr(n.name, '—')).join(', ') || '—'}
        </div>
      </div>

      {/* Купленные траты с заметками */}
      {spendRecords.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-white/50 uppercase tracking-wide">Купленные заметки</div>
          {spendRecords.map((r: any, i: number) => {
            const ch = characters.find((c: any) => String(c.id) === r.character_id);
            return (
              <div key={i} className="rounded border border-green-500/25 bg-green-500/5 px-3 py-2 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="font-semibold text-green-200">{r.skill_name}</span>
                    {' '}
                    <span className="text-white/40 text-xs">({asStr(ch?.name, r.character_id)})</span>
                  </div>
                  <span className="text-red-300 text-xs tabular-nums shrink-0">−{r.cost} pts</span>
                </div>
                {r.note && (
                  <div className="text-white/65 text-xs mt-0.5 italic">«{r.note}»</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-white/40">Трат не было</div>
      )}

      {/* Итог по списанию */}
      {Object.keys(spentByCharSkill).length > 0 && (
        <div className="rounded border px-3 py-2 bg-zinc-950/30 text-sm space-y-1">
          <div className="text-xs text-white/50 uppercase tracking-wide flex items-center gap-1 mb-1">
            <Coins className="w-3 h-3" /> Будет списано (итого: {totalSpent} pts)
          </div>
          {Object.entries(spentByCharSkill).map(([charId, skills]) => {
            const ch = characters.find((c: any) => String(c.id) === charId);
            return (
              <div key={charId}>
                <div className="text-white/50 text-xs mb-0.5">{asStr(ch?.name, charId)}</div>
                {Object.entries(skills).map(([skill, pts]) => (
                  <div key={skill} className="flex justify-between pl-2">
                    <span className="text-white/70">{skill}</span>
                    <span className="text-red-300 font-semibold tabular-nums">−{pts} pts</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {isGm && !isDone && (
        <div className="text-xs text-white/40 italic">
          Нажми «Отправить» — очки спишутся и действие закроется.
        </div>
      )}

      {isDone && (
        <div className="rounded border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-300">
          Разговор завершён. Очки списаны.
        </div>
      )}
    </div>
  );
}