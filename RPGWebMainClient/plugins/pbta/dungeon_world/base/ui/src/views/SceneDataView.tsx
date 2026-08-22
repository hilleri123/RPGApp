'use client';

import {
  MODE_BADGE_CLASS,
  MODE_HINT,
  MODE_LABEL,
  MODE_MOVE_EXAMPLES,
  normalizeSceneMode,
  type SceneData,
  type SceneMode,
} from '../shared/sceneModes';
import { SceneModeIcon } from '../shared/SceneModeIcon';

type Props = {
  scene?: Record<string, any>;
  data: SceneData | Record<string, any> | null | undefined;
};

export default function SceneDataView({ data }: Props) {
  const mode = normalizeSceneMode((data as SceneData | null | undefined)?.mode);

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
    </div>
  );
}

