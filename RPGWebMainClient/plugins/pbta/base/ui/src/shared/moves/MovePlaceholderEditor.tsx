'use client';

import { Input } from '@/components/ui/input';
import type { MovePlaceholder, Move, Playbook } from '../../types/pbta';
import { optionsForMovePick } from './placeholders';

type MovePlaceholderEditorProps = {
  placeholders: MovePlaceholder[];
  picks: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
  playbooks?: Playbook[];
  movesMap?: Map<string, Move>;
  playbookId?: string;
  characterLevel?: number;
};

export function MovePlaceholderEditor({
  placeholders,
  picks,
  onChange,
  disabled = false,
  playbooks = [],
  movesMap = new Map(),
  playbookId = '',
  characterLevel = 1,
}: MovePlaceholderEditorProps) {
  if (!placeholders.length) return null;

  const setPick = (phId: string, value: string) => {
    onChange({ ...picks, [phId]: value });
  };

  return (
    <div
      className="space-y-2 rounded border border-indigo-900/40 bg-indigo-950/20 px-2 py-2 select-text"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[10px] uppercase tracking-wide text-indigo-300/80">Выборы на листе</div>
      {placeholders.map((ph) => {
        const value = picks[ph.id] ?? '';
        const kind = ph.kind ?? 'text';

        if (kind === 'enum') {
          return (
            <label key={ph.id} className="block space-y-1">
              <span className="text-xs text-gray-400">{ph.label}</span>
              <select
                className="w-full rounded border border-gray-700 bg-black/40 text-gray-100 text-sm px-2 py-1"
                value={value}
                disabled={disabled}
                onChange={(e) => setPick(ph.id, e.target.value)}
              >
                <option value="">— выберите —</option>
                {(ph.options ?? []).map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (kind === 'move_pick') {
          const opts = optionsForMovePick(
            playbooks,
            movesMap,
            playbookId,
            characterLevel,
            ph,
          );
          return (
            <label key={ph.id} className="block space-y-1">
              <span className="text-xs text-gray-400">{ph.label}</span>
              <select
                className="w-full rounded border border-gray-700 bg-black/40 text-gray-100 text-sm px-2 py-1"
                value={value}
                disabled={disabled}
                onChange={(e) => setPick(ph.id, e.target.value)}
              >
                <option value="">— выберите ход —</option>
                {opts.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        return (
          <label key={ph.id} className="block space-y-1">
            <span className="text-xs text-gray-400">{ph.label}</span>
            <Input
              value={value}
              disabled={disabled}
              onChange={(e) => setPick(ph.id, e.target.value)}
              className="bg-black/40 border-gray-700 text-sm"
              placeholder={ph.label}
            />
          </label>
        );
      })}
    </div>
  );
}
