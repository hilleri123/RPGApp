'use client';
import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function ActionResultStage({ user_id, action }: any) {
  const wf: any = action?.workflow ?? {};
  const ctx = (wf?.stageData && Object.keys(wf.stageData).length > 0)
  ? wf.stageData
  : (wf?.context ?? {});
  const entry = ctx?.entry ?? {};

  const success: boolean | null = entry?.success ?? null;
  const results: number[] = Array.isArray(entry?.dice_results) ? entry.dice_results : [];
  const isGmRejected = entry?.gm_approved === false;

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Результат действия</div>

      {/* Итоговый вердикт */}
      {isGmRejected ? (
        <div className="flex items-center gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="text-sm">
            <div className="font-semibold text-red-300">Отклонено мастером</div>
            {entry.gm_comment && <div className="text-white/60 italic mt-0.5">«{entry.gm_comment}»</div>}
          </div>
        </div>
      ) : success ? (
        <div className="flex items-center gap-2 rounded border border-green-500/40 bg-green-500/10 px-3 py-2">
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
          <div className="text-sm font-semibold text-green-300">Успех!</div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="text-sm font-semibold text-red-300">Провал — Джон теряет контроль</div>
        </div>
      )}

      {/* Кубики */}
      {results.length > 0 && (
        <div className="rounded border px-3 py-2 bg-zinc-950/30">
          <div className="text-xs text-white/50 mb-1.5">
            Бросок {entry.dice_count}d6:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {results.map((r, i) => (
              <span key={i} className={`
                w-8 h-8 flex items-center justify-center rounded text-sm font-bold border
                ${r === 6
                  ? 'border-green-400 bg-green-500/20 text-green-300'
                  : 'border-white/20 bg-zinc-800 text-white/70'}
              `}>{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* Сводка */}
      <div className="rounded border px-3 py-2 bg-zinc-950/30 text-xs text-white/60 space-y-0.5">
        <div>Персонаж: <span className="text-white/80">{asStr(entry?.characterName)}</span></div>
        {entry.description && <div>Заявка: <span className="text-white/80 italic">«{entry.description}»</span></div>}
        <div>Профессия: <span className={entry.has_profession ? 'text-green-300' : 'text-white/30'}>
          {entry.has_profession ? entry.profession : 'нет'}
        </span></div>
        <div>Потрачено жетонов: <span className="text-white/80">{entry.spend_tokens ?? 0}</span></div>
      </div>
    </div>
  );
}
