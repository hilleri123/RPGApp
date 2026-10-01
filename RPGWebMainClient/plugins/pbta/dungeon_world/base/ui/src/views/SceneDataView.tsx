'use client';

import {
  MODE_BADGE_CLASS,
  MODE_HINT,
  MODE_LABEL,
  normalizeSceneMode,
  type SceneData,
} from '../shared/sceneModes';
import { SceneModeIcon } from '../shared/SceneModeIcon';
import { entityNameMap, readInitiative } from '../shared/initiative';
import { InitiativeStrip } from '../shared/InitiativeStrip';

type Props = {
  scene?: Record<string, any>;
  /** Игроки сессии: по ним квадраты персонажей красятся цветом игрока. */
  players?: unknown;
  data: SceneData | Record<string, any> | null | undefined;
};

export default function SceneDataView({ scene, data, players }: Props) {
  const mode = normalizeSceneMode((data as SceneData | null | undefined)?.mode);
  const initiative = readInitiative(data);
  const names = entityNameMap(scene, players);
  // В лагере и в пути очередь ходов не ведётся (записанная в сцене — на паузе).
  const hasOrder = mode === 'action' && initiative.order.length > 0;

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-2">
        <div className="text-xs text-gray-400 uppercase tracking-wide">Тип сцены</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            title={MODE_HINT[mode]}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm font-medium ${MODE_BADGE_CLASS[mode]}`}
          >
            <SceneModeIcon mode={mode} colored={false} />
            {MODE_LABEL[mode]}
          </span>
        </div>
      </div>

      {hasOrder ? (
        <div className="rounded border border-gray-700 bg-black/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400 uppercase tracking-wide">Очередь ходов</div>
            <div className="text-xs text-gray-400">Раунд {initiative.round}</div>
          </div>

          <InitiativeStrip initiative={initiative} entities={names} />
        </div>
      ) : null}
    </div>
  );
}
