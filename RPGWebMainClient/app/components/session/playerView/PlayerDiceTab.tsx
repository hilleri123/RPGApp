'use client';

import { useState } from 'react';
import { Dices, Trash2 } from 'lucide-react';
import { CanvasSeed } from '@/plugins/common/ui';
import { usePreparedSeeds } from '@/app/services/hooks/usePreparedSeeds';

export default function PlayerDiceTab({ sessionId }: { sessionId: string }) {
  const { items, add, remove, reorder } = usePreparedSeeds(sessionId);
  const [draft, setDraft] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);

  async function stash() {
    if (!draft || busy) return;
    setBusy(true);
    setError('');
    try {
      await add(draft);
      setDraft(null);
      setCanvasKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось положить жест в запас');
    } finally {
      setBusy(false);
    }
  }

  function move(id: string, targetId: string) {
    if (id === targetId) return;
    const ids = items.map((item) => item.id);
    const from = ids.indexOf(id);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    void reorder(ids);
  }

  return (
    <div className="h-full overflow-y-auto p-3 text-gray-100">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-medium">
            <Dices className="h-4 w-4 text-violet-300" />
            Запас жестов
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            Нарисуйте жест и положите его в очередь. На броске картинка уйдёт сама, с начала списка.
            Сейчас в запасе: {items.length}.
          </p>
        </div>

        <div className="rounded border border-gray-700 bg-gray-950/40 p-3">
          <CanvasSeed
            key={canvasKey}
            onChange={setDraft}
            hint="Один жест — одна картинка. Штрихи сами в запас не попадают."
          />
          <button
            type="button"
            disabled={!draft || busy}
            onClick={() => void stash()}
            className="mt-2 rounded border border-violet-400/70 px-3 py-2 text-sm font-semibold text-violet-100 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30"
          >
            {busy ? 'Кладём…' : 'В запас'}
          </button>
          {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Очередь пуста. Броски по-прежнему рисуются на самой стадии.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item, index) => (
              <li
                key={item.id}
                draggable
                onDragStart={() => setDragId(item.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragId) move(dragId, item.id);
                  setDragId(null);
                }}
                className="flex items-center gap-3 rounded border border-gray-700 bg-gray-900/60 p-2"
              >
                <span className="w-5 text-center text-xs text-gray-500">{index + 1}</span>
                <img
                  src={item.image}
                  alt=""
                  className="h-14 w-28 rounded border border-white/10 bg-black object-cover"
                />
                <span className="min-w-0 flex-1 text-xs text-gray-400">
                  {index === 0 ? 'следующий бросок' : 'в очереди'}
                </span>
                <button
                  type="button"
                  className="rounded border border-gray-700 p-1.5 text-gray-300 hover:border-red-400/60 hover:text-red-200"
                  onClick={() => void remove(item.id)}
                  aria-label="Удалить жест"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
