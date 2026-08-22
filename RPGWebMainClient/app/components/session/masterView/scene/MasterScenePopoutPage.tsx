'use client';

import { useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ExternalLink, Loader2 } from 'lucide-react';

import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { useAuth } from '@/app/services/hooks/useAuth';
import { useMasterUiStore } from '@/app/services/stores/masterUi';
import SceneBody from '@/app/components/session/masterView/scene/SceneBody';
import { NotificationCenter } from '@/app/components/session/common/NotificationCenter';
import { ActiveActionCenter } from '@/app/components/session/common/ActiveActionCenter';
import { MinimizedActionDock } from '@/app/components/session/common/MinimizedActionDock';
import { SessionPresentedEntityOverlay } from '@/app/components/session/common/SessionPresentedEntityOverlay';
import { ConnectionLostBanner } from '@/app/components/session/common/ConnectionStatus';
import { MasterNotesProvider } from '@/app/components/masterNotes/MasterNotesContext';
import type { Scene } from '@/app/services/types/session';

/**
 * Slim master view locked to one scene — for a secondary monitor / pop-out window.
 * Primary scene selection stays on the main session tab (separate Zustand realm).
 */
export default function MasterScenePopoutPage({ sceneId }: { sceneId: string }) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const { state } = useAuth();
  const { user, loading } = state;

  const {
    connected,
    session,
    scenes,
    isMaster,
    presentedEntity,
    dismissPresentedEntity,
    selfPlayer,
    pluginUI,
  } = useSessionWebSocket(sessionId);

  const setCurrentSceneId = useMasterUiStore((s) => s.setCurrentSceneId);
  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);
  const lockedSceneId = String(sceneId);

  // Keep this window locked to the URL scene (primary scene stays on the main tab).
  useEffect(() => {
    if (currentSceneId !== lockedSceneId) setCurrentSceneId(lockedSceneId);
  }, [lockedSceneId, currentSceneId, setCurrentSceneId]);

  const scene: Scene | null = useMemo(() => {
    return (scenes?.find((s: Scene) => String(s.id) === lockedSceneId) ?? null) as Scene | null;
  }, [scenes, lockedSceneId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const name = scene?.name ? String(scene.name) : 'Сцена';
    document.title = `${name} · pop-out`;
  }, [scene?.name]);

  if (!user || loading || !session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-white">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!isMaster) {
    return <div className="min-h-screen bg-gray-900 text-white p-6">Нужна роль мастера</div>;
  }

  return (
    <MasterNotesProvider sessionId={sessionId}>
      <div className="flex h-screen min-h-0 bg-gray-900 text-white overflow-hidden flex-col">
        <ConnectionLostBanner />
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-950">
          <ExternalLink className="w-4 h-4 text-violet-300 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">
              {scene?.name ?? 'Сцена'}
            </div>
            <div className="text-[11px] text-gray-500">
              Отдельное окно · основная сцена остаётся на главном экране
              {!connected ? ' · нет связи' : ''}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <SceneBody sceneId={lockedSceneId} />
        </div>

        <NotificationCenter sessionId={sessionId} />
        <ActiveActionCenter sessionId={sessionId} />
        <MinimizedActionDock sessionId={sessionId} />
        <SessionPresentedEntityOverlay
          presentedEntity={presentedEntity}
          isMaster={isMaster}
          selfPlayer={selfPlayer}
          scenes={scenes}
          onDismiss={dismissPresentedEntity}
          pluginUI={pluginUI}
          scenarioId={session?.scenario_id ? String(session.scenario_id) : null}
        />
      </div>
    </MasterNotesProvider>
  );
}
