// NoteShowTab.tsx
'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { Note } from '@/app/services/types2';

interface Character {
  id: string;
  name: string;
}

interface NoteShowTabProps {
  note: Note;
  characters: Character[];
  onShow: (characterIds: string[], includeMaster?: boolean) => Promise<void>;
  showMasterOption?: boolean;
  defaultIncludeMaster?: boolean;
}

export function NoteShowTab({
  note,
  characters,
  onShow,
  showMasterOption = false,
  defaultIncludeMaster = true,
}: NoteShowTabProps) {
  const allowed = new Set<string>(
    (note.allowed_character_shown_json ?? []).map(String)
  );

  const [selected, setSelected] = useState<Set<string>>(new Set(allowed));
  const [includeMaster, setIncludeMaster] = useState(defaultIncludeMaster);
  const [confirmAlert, setConfirmAlert] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setConfirmAlert(false); // сбросить предупреждение при изменении
  };

  // Персонажи выбранные, но НЕ входящие в allowed
  const unauthorized = [...selected].filter((id) => !allowed.has(id));
  const hasUnauthorized = unauthorized.length > 0;

  const handleShowClick = () => {
    if (hasUnauthorized && !confirmAlert) {
      // Первое нажатие — показать предупреждение
      setConfirmAlert(true);
      return;
    }
    // Второе нажатие (или нет чужих) — отправить
    void submit();
  };

  const submit = async () => {
    setLoading(true);
    try {
      await onShow([...selected], showMasterOption ? includeMaster : undefined);
      setConfirmAlert(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400">
        Выберите персонажей, которым показать заметку:
      </div>

      <div className="space-y-2">
        {showMasterOption ? (
          <label className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer border border-gray-700 bg-gray-800">
            <Checkbox checked={includeMaster} onCheckedChange={(v) => setIncludeMaster(Boolean(v))} />
            <span className="text-sm text-white flex-1">Мастер</span>
          </label>
        ) : null}
        {characters.map((c) => {
          const isAllowed = allowed.size === 0 || allowed.has(c.id); // пустой = всем
          const isSelected = selected.has(c.id);
          const isUnauthorized = isSelected && !isAllowed;

          return (
            <label
              key={c.id}
              className={`flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer border transition-colors
                ${isUnauthorized
                  ? 'border-yellow-500/60 bg-yellow-500/10'
                  : 'border-gray-700 bg-gray-800 hover:bg-gray-750'
                }`}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggle(c.id)}
              />
              <span className="text-sm text-white flex-1">{c.name}</span>
              {!isAllowed && (
                <span className="text-xs text-gray-500 italic">не предназначалось</span>
              )}
              {isUnauthorized && (
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
              )}
            </label>
          );
        })}

        {characters.length === 0 && (
          <div className="text-xs text-gray-500 italic">Нет персонажей в сессии</div>
        )}
      </div>

      {/* Предупреждение при confirmAlert */}
      {confirmAlert && hasUnauthorized && (
        <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-300">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <AlertTriangle className="w-4 h-4" />
            Внимание
          </div>
          Выбраны персонажи, которым эта заметка не предназначалась:{' '}
          <span className="font-semibold">
            {unauthorized
              .map((id) => characters.find((c) => c.id === id)?.name ?? id)
              .join(', ')}
          </span>
          . Нажмите ещё раз для подтверждения.
        </div>
      )}

      <Button
        className="w-full"
        disabled={(selected.size === 0 && !(showMasterOption && includeMaster)) || loading}
        onClick={handleShowClick}
        variant={confirmAlert ? 'destructive' : 'default'}
      >
        {confirmAlert ? 'Подтвердить и показать' : 'Показать выбранным'}
      </Button>
    </div>
  );
}
