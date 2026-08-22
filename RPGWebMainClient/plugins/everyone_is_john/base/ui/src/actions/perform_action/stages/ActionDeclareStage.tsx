'use client';
import React, { useMemo } from 'react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }
function clampInt(n: any, lo: number, hi: number, fb: number) {
  const v = Number(n); if (!Number.isFinite(v)) return fb;
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

export function ActionDeclareStage({ user_id, action, value, patch }: any) {
  const wf: any = action?.workflow ?? {};
  const ctx = (wf?.stageData && Object.keys(wf.stageData).length > 0)
  ? wf.stageData
  : (wf?.context ?? {});
  const entry = ctx?.entry ?? {};

  const profession = asStr(entry?.profession);
  const available = Number(entry?.available_tokens ?? 0);

  const description  = value?.description  ?? '';
  const spend_tokens = clampInt(value?.spend_tokens, 0, available, 0);
  const has_profession = value?.has_profession ?? false;

  // предварительный подсчёт кубиков
  const dicePreview = useMemo(() => {
    let d = 3;
    if (has_profession) d += 4;
    d += 2 * spend_tokens;
    return d;
  }, [has_profession, spend_tokens]);

    // внутри компонента, после dicePreview:
  const successChance = useMemo(() => {
    const n = dicePreview;
    if (n <= 0) return 0;
    const pFailAll = Math.pow(5 / 6, n);   // ни одной 6
    return (1 - pFailAll) * 100;           // в процентах
  }, [dicePreview]);


  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Заявить действие</div>

      <div className="rounded border px-3 py-2 bg-zinc-950/30 space-y-1 text-sm">
        <div>Персонаж: <span className="font-semibold text-white">{asStr(entry?.characterName, '—')}</span></div>
        {profession && <div className="text-white/60">Профессия: <span className="text-white/80">{profession}</span></div>}
        <div>Жетонов: <span className="text-white/80 tabular-nums">{available}</span></div>
      </div>

      {/* Описание */}
      <textarea
        className="w-full rounded border bg-zinc-950/30 px-3 py-2 text-sm resize-none"
        placeholder="Опишите действие (необязательно)…"
        rows={3}
        value={description}
        onChange={(e) => patch({ description: e.target.value || null })}
      />

      {/* Профессия */}
      {profession && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={has_profession}
            onChange={(e) => patch({ has_profession: e.target.checked })}
          />
          <span>
            Использую профессию <span className="text-white font-semibold">«{profession}»</span>
            <span className="text-white/50 ml-1">(+4d6)</span>
          </span>
        </label>
      )}

      {/* Жетоны */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-white/70 shrink-0">Жетонов потратить:</label>
        <input
          className="w-24 rounded border bg-zinc-950/30 px-3 py-2 text-sm"
          type="number" min={0} max={available}
          value={spend_tokens}
          onChange={(e) => patch({ spend_tokens: clampInt(e.target.value, 0, available, 0) })}
        />
        <button
          type="button"
          className="border-2 rounded px-3 py-2 text-sm font-semibold"
          onClick={() => patch({ spend_tokens: available })}
        >Max</button>
      </div>

      {/* Превью кубиков */}
      <div className="rounded border px-3 py-2 bg-zinc-950/30 text-sm">
        Будет брошено:{' '}
        <span className="font-semibold text-white">{dicePreview}d6</span>
        <span className="text-white/50 ml-2">(успех если выпадет хоть одна 6)</span>
      </div>
      <div className="text-xs text-white/70">
        Шанс успеха примерно{' '}
        <span className="font-semibold text-green-300">
          {successChance.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
