'use client';

import { useState } from 'react';
import type { Move, MoveTextOverride } from '../../types/pbta';
import {
  codexToMoveOverride,
  emptyMoveTextOverride,
  hasMoveTextOverride,
  patchMoveOverride,
} from '../../lib/moves';

type Props = {
  moveId: string;
  codexMove: Move;
  override: MoveTextOverride | undefined;
  onChange: (nextOverrides: Record<string, MoveTextOverride>) => void;
  overridesRoot: Record<string, MoveTextOverride>;
  onDone?: () => void;
};

function MoveTextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-gray-500">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded border border-gray-700 bg-black/40 text-gray-100 text-xs px-2 py-1.5 resize-y min-h-[2.5rem] select-text"
      />
    </div>
  );
}

function CodexOriginalPanel({ move }: { move: Move }) {
  const blocks: { title: string; text?: string | null }[] = [
    { title: 'Кратко', text: move.summary },
    { title: 'Когда…', text: move.trigger },
    { title: 'Эффект', text: move.effect },
    { title: '10+', text: move.effect_10_plus },
    { title: '7–9', text: move.effect_7_9 },
    { title: '6−', text: move.effect_6_minus },
  ].filter((b) => b.text?.trim());

  if (!blocks.length) {
    return <div className="text-xs text-gray-500">В кодексе нет текста для этого хода.</div>;
  }

  return (
    <div className="space-y-2 text-xs text-gray-300">
      {blocks.map((b) => (
        <div key={b.title}>
          <div className="text-[10px] uppercase text-indigo-300/70">{b.title}</div>
          <div className="whitespace-pre-line">{b.text}</div>
        </div>
      ))}
    </div>
  );
}

export function ClassMoveOverrideEditor({
  moveId,
  codexMove,
  override,
  onChange,
  overridesRoot,
  onDone,
}: Props) {
  const [showOriginal, setShowOriginal] = useState(false);
  const changed = hasMoveTextOverride(override);

  const ensureOverride = (): MoveTextOverride => {
    if (override && hasMoveTextOverride(override)) return override;
    return codexToMoveOverride(codexMove);
  };

  const patch = (patchFields: Partial<MoveTextOverride>) => {
    let root = { ...(overridesRoot ?? {}) };
    const base = root[moveId] ?? codexToMoveOverride(codexMove);
    root = patchMoveOverride(root, moveId, { ...base, ...patchFields });
    onChange(root);
  };

  const resetToCodex = () => {
    const root = { ...(overridesRoot ?? {}) };
    delete root[moveId];
    onChange(root);
    setShowOriginal(false);
  };

  const ov = ensureOverride();

  return (
    <div
      className="space-y-2 rounded border border-indigo-900/40 bg-indigo-950/20 px-2 py-2 select-text"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-2 w-full">
        <div className="text-[10px] uppercase tracking-wide text-indigo-300/80">Текст на листе</div>
        {changed && (
          <span className="text-[10px] rounded border border-amber-700/50 bg-amber-950/30 px-1.5 py-0.5 text-amber-200">
            Изменён
          </span>
        )}
        <button
          type="button"
          className="text-[10px] px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:border-gray-400"
          onClick={() => setShowOriginal((v) => !v)}
        >
          {showOriginal ? 'Скрыть оригинал' : 'Оригинал из книги'}
        </button>
        {changed && (
          <button
            type="button"
            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-600 text-gray-400 hover:text-gray-200"
            onClick={resetToCodex}
          >
            Сбросить к оригиналу
          </button>
        )}
        {onDone && (
          <button
            type="button"
            className="text-[10px] px-1.5 py-0.5 rounded border border-indigo-600 text-indigo-200 hover:bg-indigo-950/40 ml-auto"
            onClick={onDone}
          >
            Готово
          </button>
        )}
      </div>

      {showOriginal && (
        <div className="rounded border border-gray-700 bg-black/30 p-2 max-h-48 overflow-y-auto">
          <CodexOriginalPanel move={codexMove} />
        </div>
      )}

      <MoveTextArea label="Название" value={ov.title ?? ''} onChange={(v) => patch({ title: v })} />
      <MoveTextArea label="Кратко" value={ov.summary ?? ''} onChange={(v) => patch({ summary: v })} />
      <MoveTextArea label="Триггер" value={ov.trigger ?? ''} onChange={(v) => patch({ trigger: v })} />
      <MoveTextArea label="Эффект (общий)" value={ov.effect ?? ''} onChange={(v) => patch({ effect: v })} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <MoveTextArea label="10+" value={ov.effect_10_plus ?? ''} onChange={(v) => patch({ effect_10_plus: v })} />
        <MoveTextArea label="7–9" value={ov.effect_7_9 ?? ''} onChange={(v) => patch({ effect_7_9: v })} />
        <MoveTextArea label="6−" value={ov.effect_6_minus ?? ''} onChange={(v) => patch({ effect_6_minus: v })} />
      </div>
    </div>
  );
}

export { emptyMoveTextOverride, hasMoveTextOverride };
