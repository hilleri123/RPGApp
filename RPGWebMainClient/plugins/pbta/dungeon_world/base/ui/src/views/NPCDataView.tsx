'use client';

import type { NpcData } from '../types';

type Props = {
  data: Record<string, any>;
};

export default function NpcDataView({ data }: Props) {
  const npc = (data ?? {}) as NpcData;

  return (
    <div className="space-y-3 text-sm">

      {/* Боевые параметры */}
      <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-2">
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="text-gray-400">
            ОЗ:{' '}
            <span className="text-sky-300 font-semibold">{npc.hp_current}</span>
            <span className="text-gray-600"> / {npc.hp}</span>
          </span>
          <span className="text-gray-400">
            Броня: <span className="text-gray-200 font-semibold">{npc.armor}</span>
          </span>
        </div>

        {/* Теги */}
        {(npc.group_tags?.length > 0 || npc.special_qualities?.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {npc.group_tags?.map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded border border-indigo-800/50 bg-indigo-950/30 text-indigo-300">
                {t}
              </span>
            ))}
            {npc.special_qualities?.map((q) => (
              <span key={q} className="text-xs px-2 py-0.5 rounded border border-gray-700 bg-black/20 text-gray-300">
                {q}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Инстинкт */}
      {npc.instinct && (
        <div className="text-xs text-gray-400 italic">
          Инстинкт: <span className="text-gray-200 not-italic">{npc.instinct}</span>
        </div>
      )}

      {/* Атаки */}
      {npc.attacks?.length > 0 && (
        <div className="space-y-1">
          <div className="text-gray-300">Атаки</div>
          <div className="divide-y divide-gray-800 border border-gray-700 rounded-md overflow-hidden bg-black/20">
            {npc.attacks.map((a, i) => (
              <div key={i} className="px-3 py-2 space-y-0.5">
                <div className="text-gray-100 font-medium">{a.name}</div>
                <div className="text-xs font-mono text-gray-400">
                  {[
                    a.damage,
                    ...a.range_tags,
                    ...a.attack_tags,
                  ].filter(Boolean).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ходы мастера */}
      {npc.moves?.length > 0 && (
        <div className="space-y-1">
          <div className="text-gray-300">Ходы</div>
          <div className="divide-y divide-gray-800 border border-gray-700 rounded-md overflow-hidden bg-black/20">
            {npc.moves.map((m) => (
              <div key={m.id} className="px-3 py-2 space-y-0.5">
                <div className="text-gray-100 text-xs font-medium">{m.title}</div>
                {m.description && (
                  <div className="text-xs text-gray-500">{m.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback */}
      {!npc.hp && !npc.attacks?.length && (
        <pre className="text-xs bg-black/30 border border-gray-700 rounded p-2 overflow-x-auto">
          {JSON.stringify(data ?? {}, null, 2)}
        </pre>
      )}

    </div>
  );
}