'use client';

import React, { useEffect, useState } from 'react';
import { Skull } from 'lucide-react';

export function TerrifySetupStage({ user_id, action, value, onSubmit, setSubmitEnabled }: any) {
  const participants = action?.participants ?? {};
  const isGm = String(participants?.gmUserId ?? '') === String(user_id);
  const characters = action?.scene?.scene?.characters ?? [];

  const [damage, setDamage] = useState<number>(value?.damage ?? 1);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    value?.selected_ids ?? characters.map((c: any) => String(c.id))
  );

  useEffect(() => {
    setSubmitEnabled(isGm && damage > 0 && selectedIds.length > 0);
  }, [isGm, damage, selectedIds, setSubmitEnabled]);

  const toggleChar = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (!isGm || damage <= 0 || selectedIds.length === 0) return;
    onSubmit({
      action: 'setup',
      damage,
      selected_ids: selectedIds,
    });
  };

  if (!isGm) {
    return (
      <div className="rounded border p-3 text-sm text-white/40">
        Мастер настраивает проверку ужаса...
      </div>
    );
  }

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <Skull className="w-4 h-4 text-purple-400" />
        Terrify — настройка
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-white/40">Урон по стабильности</div>
        <input
          type="number"
          min={1}
          value={damage}
          onChange={(e) => setDamage(Math.max(1, Number(e.target.value)))}
          className="w-24 rounded border border-white/20 bg-zinc-900 px-3 py-1.5 text-sm text-white"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/40">Цели</div>
          <button
            type="button"
            onClick={() =>
              setSelectedIds(
                selectedIds.length === characters.length
                  ? []
                  : characters.map((c: any) => String(c.id))
              )
            }
            className="text-xs text-white/40 hover:text-white/70"
          >
            {selectedIds.length === characters.length ? 'Снять все' : 'Выбрать всех'}
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {characters.map((c: any) => {
            const id = String(c.id);
            const checked = selectedIds.includes(id);
            return (
              <label
                key={id}
                className={`flex items-center gap-2 rounded border px-3 py-1.5 cursor-pointer transition-colors ${
                  checked
                    ? 'border-purple-500/40 bg-purple-500/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleChar(id)}
                  className="accent-purple-400"
                />
                <span className="text-sm text-white/80">
                  {c.name || `Персонаж ${id.slice(0, 6)}`}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isGm || damage <= 0 || selectedIds.length === 0}
        className="rounded border border-purple-400/70 px-3 py-2 text-sm font-semibold text-purple-200 hover:bg-purple-500/10 disabled:opacity-40"
      >
        Применить
      </button>
    </div>
  );
}
