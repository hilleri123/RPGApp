'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';

import { useAuth } from '@/app/services/hooks/useAuth';
import { usePlayerSessionWebSocket } from '@/app/services/hooks/usePlayerSessionWebSocket';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';

import PlayerPage from '@/app/components/session/playerView/PlayerView';
import { GameItem, Location } from '@/app/services/types2';
import { NotificationCenter } from '../../common/NotificationCenter';
import { ActiveActionCenter } from '../../common/ActiveActionCenter';
import { MinimizedActionDock } from '../../common/MinimizedActionDock';
import { CampaignSessionBanner } from '../../common/CampaignSessionBanner';
import { SessionPresentedEntityOverlay } from '../../common/SessionPresentedEntityOverlay';
import { ConnectionLostBanner } from '../../common/ConnectionStatus';
import { PlayerMirrorProvider } from './PlayerMirrorContext';

function PlayerMirrorBody({
  sessionId,
  playerUserId,
}: {
  sessionId: string;
  playerUserId: string;
}) {
  const { state } = useAuth();
  const { user, loading } = state;
  const master = useSessionWebSocket(sessionId);

  const {
    connected,
    session,
    locations,
    items,
    selfPlayer,
    scenes,
    presentedEntity,
    pluginUI,
  } = usePlayerSessionWebSocket(sessionId);

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [editingGameItem, setEditingGameItem] = useState<GameItem | null>(null);

  const playerLabel = useMemo(() => {
    const name = selfPlayer?.name || selfPlayer?.user?.full_name || selfPlayer?.user?.email;
    return name ? String(name) : playerUserId;
  }, [selfPlayer, playerUserId]);

  useEffect(() => {
    if (!currentLocation) return;
    const fresh = locations?.find((loc) => loc.id === currentLocation.id) || null;
    setCurrentLocation(fresh);
  }, [locations, currentLocation?.id]);

  useEffect(() => {
    if (!editingGameItem) return;
    const fresh = items?.find((i) => i.id === editingGameItem.id) || null;
    setEditingGameItem(fresh);
  }, [items, editingGameItem?.id]);

  if (!user || loading || !master.session) {
    return (
      <div className="h-[100dvh] bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!selfPlayer) {
    return (
      <div className="h-[100dvh] bg-gray-900 flex items-center justify-center p-6 text-center text-white">
        <div className="max-w-sm space-y-2">
          <Eye className="w-8 h-8 mx-auto text-cyan-300" />
          <p className="font-medium">Игрок не найден</p>
          <p className="text-sm text-white/50">
            В сессии нет игрока с id {playerUserId}. Закройте окно и откройте зеркало снова.
          </p>
        </div>
      </div>
    );
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
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-cyan-500/30 bg-cyan-950/40 text-sm text-cyan-100">
        <Eye className="w-4 h-4 shrink-0" />
        <span className="truncate">
          Просмотр глаз игрока: <strong>{playerLabel}</strong>
          <span className="text-cyan-200/60"> — команды не отправляются</span>
        </span>
        {!connected ? (
          <span className="ml-auto text-[11px] text-amber-200/80">нет связи</span>
        ) : null}
      </div>
      <ConnectionLostBanner />
      <CampaignSessionBanner sessionId={sessionId} />
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

export default function PlayerMirrorPage({
  sessionId,
  playerUserId,
}: {
  sessionId: string;
  playerUserId: string;
}) {
  return (
    <PlayerMirrorProvider playerUserId={playerUserId}>
      <PlayerMirrorBody sessionId={sessionId} playerUserId={playerUserId} />
    </PlayerMirrorProvider>
  );
}
