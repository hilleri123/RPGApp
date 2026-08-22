'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { NotificationCenter } from '@/app/components/session/common/NotificationCenter';
import { ActiveActionCenter } from '@/app/components/session/common/ActiveActionCenter';
import { MinimizedActionDock } from '@/app/components/session/common/MinimizedActionDock';

import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { useAuth } from '@/app/services/hooks/useAuth';

import type { GameItem, Location, PlayerCharacter } from '@/app/services/types2';

import SceneWorkspace from '@/app/components/session/masterView/scene/SceneWorkspace';
import SceneControlPanel from '@/app/components/session/masterView/control/SceneControlPanel';

import { useMasterUiStore } from '@/app/services/stores/masterUi';
import { MasterLeftColumn } from '@/app/components/session/masterView/MasterLeftColumn';
import { CampaignSessionBanner } from '@/app/components/session/common/CampaignSessionBanner';
import { MasterNotesProvider } from '@/app/components/masterNotes/MasterNotesContext';
import { SessionPresentedEntityOverlay } from '@/app/components/session/common/SessionPresentedEntityOverlay';
import { ConnectionLostBanner } from '@/app/components/session/common/ConnectionStatus';

export default function SessionMasterPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const { state } = useAuth();
  const { user, loading } = state;

  const { connected, session, scenes, isMaster, presentedEntity, dismissPresentedEntity, selfPlayer, pluginUI } =
    useSessionWebSocket(sessionId);

  // эти стейты ты не просил переносить, оставляю локально как раньше
  const [editingCharacter, setEditingCharacter] = useState<PlayerCharacter | null>(null);
  const [editingGameItem, setEditingGameItem] = useState<GameItem | null>(null);

  const setCurrentSceneId = useMasterUiStore((s) => s.setCurrentSceneId);
  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);

  const currentLocationId = useMasterUiStore((s) => s.currentLocationId);
  const setSceneLocationId = useMasterUiStore((s) => s.setSceneLocationId);

  // init currentSceneId once
  useEffect(() => {
    if (!connected) return;
    if (currentSceneId) return;
    if (!scenes?.length) return;
    setCurrentSceneId(String(scenes[0].id));
  }, [connected, scenes, currentSceneId, setCurrentSceneId]);

  // --- gating ---
  // Гейт намеренно не смотрит на connected: как только данные сессии получены,
  // короткий разрыв не должен подменять весь экран спиннером посреди игры.
  // О состоянии связи сообщает ConnectionLostBanner, действия копятся в очереди.
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

  if (!isMaster) return <div>У тебя нет роли</div>;

  return (
    <MasterNotesProvider sessionId={sessionId}>
    <div className="flex h-screen min-h-0 bg-gray-900 text-white overflow-hidden flex-col">
      <ConnectionLostBanner />
      <CampaignSessionBanner sessionId={sessionId} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* 1) Left column */}
      <MasterLeftColumn sessionId={sessionId} />

      {/* Scene — main area */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <SceneWorkspace
          currentLocationId={currentLocationId}
          onSceneLocationChange={setSceneLocationId}
        />
        <SceneControlPanel />
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
    </div>
    </MasterNotesProvider>
  );
}
