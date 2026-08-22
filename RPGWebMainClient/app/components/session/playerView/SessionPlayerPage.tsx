'use client';

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/app/services/hooks/useAuth";
import { usePlayerSessionWebSocket } from "@/app/services/hooks/usePlayerSessionWebSocket";

import PlayerPage from "@/app/components/session/playerView/PlayerView";

import { GameItem, Location } from "@/app/services/types2";
import { NotificationCenter } from "../common/NotificationCenter";
import { ActiveActionCenter } from "../common/ActiveActionCenter";
import { MinimizedActionDock } from "../common/MinimizedActionDock";
import { CampaignSessionBanner } from '../common/CampaignSessionBanner';
import { SessionPresentedEntityOverlay } from '../common/SessionPresentedEntityOverlay';
import { ConnectionLostBanner } from '../common/ConnectionStatus';

export default function SessionPlayerPage({ sessionId }: { sessionId: string }) {
  const { state } = useAuth();
  const { user, loading } = state;

  const {
    connected,
    session,
    locations,
    items,
    selfPlayer,
    isPlayer,
    scenes,
    presentedEntity,
    pluginUI,
  } = usePlayerSessionWebSocket(sessionId);

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [editingGameItem, setEditingGameItem] = useState<GameItem | null>(null);

  useEffect(() => {
    if (!currentLocation) return;
    const fresh = locations?.find(loc => loc.id === currentLocation.id) || null;
    setCurrentLocation(fresh);
  }, [locations, currentLocation?.id]);

  useEffect(() => {
    if (!editingGameItem) return;
    const fresh = items?.find(i => i.id === editingGameItem.id) || null;
    setEditingGameItem(fresh);
  }, [items, editingGameItem?.id]);

  // Гейт намеренно не смотрит на connected: как только данные сессии получены,
  // короткий разрыв не должен подменять весь экран спиннером посреди игры.
  // О состоянии связи сообщает ConnectionLostBanner, действия копятся в очереди.
  if (!user || loading || !session) {
    return (
      <div className="h-[100dvh] bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!isPlayer || !selfPlayer) {
    return <div className="text-white p-4">У тебя нет роли</div>;
  }

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-hidden bg-gray-900 text-white"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <ConnectionLostBanner />
      <CampaignSessionBanner sessionId={sessionId} compact />
      <div className="flex-1 min-h-0">
        <PlayerPage
          sessionId={sessionId}
          currentLocation={currentLocation}
          setCurrentLocation={setCurrentLocation}
          setEditingGameItem={setEditingGameItem}
        />
      </div>

      <NotificationCenter sessionId={sessionId} />
      <ActiveActionCenter sessionId={sessionId} />
      <MinimizedActionDock sessionId={sessionId} />
      <SessionPresentedEntityOverlay
        presentedEntity={presentedEntity}
        selfPlayer={selfPlayer}
        scenes={scenes}
        pluginUI={pluginUI}
        scenarioId={session?.scenario_id ? String(session.scenario_id) : null}
      />
    </div>
  );
}
