'use client';

import SessionTimePanel from './SessionTimePanel';
import { SessionScenesTimeline } from './SessionScenesTimeline';
import type { Scene, SessionTimeline } from '@/app/services/types/session';

export function TimelineTabPanel({
  sessionId,
  scenes,
  timeline,
  currentSceneId,
  onSelectScene,
}: {
  sessionId: string;
  scenes: Scene[];
  timeline?: SessionTimeline | null;
  currentSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 px-3 py-2 overflow-hidden">
      <SessionTimePanel sessionId={sessionId} timeline={timeline} compact />
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5 shrink-0">
          Таймлайн сцен
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <SessionScenesTimeline
            scenes={scenes}
            timeline={timeline}
            currentSceneId={currentSceneId}
            onSelectScene={onSelectScene}
            fullHeight
          />
        </div>
      </div>
    </div>
  );
}
