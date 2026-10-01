'use client';

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Header from '@/app/components/layout/Header';
import { MasterCard } from '@/app/components/lobby/MasterCard';
import { LobbyAccessCard } from '@/app/components/lobby/LobbyAccessCard';
import { ScenarioInfo } from '@/app/components/lobby/ScenarioInfo';
import { Players } from "@/app/components/lobby/Players";
import { Characters } from "@/app/components/lobby/Characters";
import { LobbyPlayerView } from '@/app/components/lobby/LobbyPlayerView';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { useParams, useSearchParams } from 'next/navigation';
import { CloseLobbyDialog } from '@/app/components/lobby/CloseLobbyDialog';
import { useAuth } from '@/app/services/hooks/useAuth';
import { LobbyWebSocketProvider } from '@/app/services/providers/LobbyWebSocketProvider';
import { useLobbyWebSocket } from '@/app/services/hooks/useLobbyWebSocket';
import { playerHasCharacterAssignment } from '@/app/components/lobby/lobbyCharacterOccupancy';
import { launchedScenariosApi } from '@/app/services/api/launchedScenarios';
import { RequireAuth } from '@/app/components/auth/RequireAuth';


export default function LobbyPageWrapper() {
  const params = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <LobbyWebSocketProvider lobbyId={params.id}>
        <LobbyPage lobbyId={params.id} />
      </LobbyWebSocketProvider>
    </RequireAuth>
  );
}


function LobbyMasterView({ lobbyId }: { lobbyId: string }) {
  const searchParams = useSearchParams();
  const campaignFromUrl = searchParams.get('campaign_id');

  const {
    lobby,
    connected,
    masterStartSession,
    masterCloseLobby,
    masterSelectCampaign,
    lobbyError,
  } = useLobbyWebSocket(lobbyId);

  const [launchedApproachBusy, setLaunchedApproachBusy] = useState(false);
  const [campaignAttached, setCampaignAttached] = useState(false);

  useEffect(() => {
    if (!campaignFromUrl || !connected || campaignAttached || lobby?.campaign_id) return;
    masterSelectCampaign(campaignFromUrl);
    setCampaignAttached(true);
  }, [
    campaignFromUrl,
    connected,
    campaignAttached,
    lobby?.campaign_id,
    masterSelectCampaign,
  ]);

  useEffect(() => {
    const launchedId = lobby?.launched_scenario_id;
    if (!launchedId) {
      setLaunchedApproachBusy(false);
      return;
    }
    void launchedScenariosApi.list().then((list) => {
      const item = list.find((x) => x.id === launchedId);
      setLaunchedApproachBusy(Boolean(item?.active_approach_session_id));
    }).catch(() => setLaunchedApproachBusy(false));
  }, [lobby?.launched_scenario_id]);

  const allPlayersReady =
    (lobby?.players || []).length > 0 &&
    (lobby?.players || []).every((p: any) => {
      if (lobby?.campaign_id) {
        return p.is_ready;
      }
      return p.is_ready && playerHasCharacterAssignment(p);
    });

  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-gray-900"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <Header section={`${lobby.name} ${connected ? "" : "не подключен"}`} />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-6 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
            <div className="lg:col-span-1 space-y-4 md:space-y-6">
              <MasterCard lobbyId={lobbyId} />
              <LobbyAccessCard lobbyId={lobbyId} />
            </div>
            <div className="lg:col-span-2"><ScenarioInfo lobbyId={lobbyId} /></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <Players lobbyId={lobbyId} />
            {lobby?.scenario ? <Characters lobbyId={lobbyId} /> : null}
          </div>
        </div>
      </div>

      <div
        className="shrink-0 border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm px-4 py-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-2">
          <Button
            disabled={!allPlayersReady || launchedApproachBusy}
            className="flex-1 h-11"
            onClick={() => masterStartSession()}
          >
            Запустить сессию
          </Button>
          <CloseLobbyDialog
            onConfirm={() => {
              masterCloseLobby();
              toast.success('Лобби закрывается…');
            }}
          />
        </div>
        {launchedApproachBusy ? (
          <p className="text-sm text-red-300 mt-2 text-center sm:text-left">
            {lobbyError?.message ?? 'У выбранного сценария уже есть активный подход'}
          </p>
        ) : null}
      </div>
    </div>
  );
}


function LobbyPage({ lobbyId }: { lobbyId: string }) {
  const { state } = useAuth();
  const { user, loading } = state;

  const {
    lobby,
    connected,
    selfPlayer,
    isMaster,
    isPlayer,
    userBecomePlayer,
  } = useLobbyWebSocket(lobbyId);

  useEffect(() => {
    if (!user) return;
    if (isMaster) return;
    if (selfPlayer) return;
    userBecomePlayer(user.full_name);
  }, [user, isMaster, selfPlayer, userBecomePlayer]);

  if (!user || loading || !connected) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-white">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="p-4 text-white">
        <p>{connected ? 'Загрузка лобби...' : 'Нет подключения к серверу'}</p>
      </div>
    );
  }

  if (isMaster) {
    return <LobbyMasterView lobbyId={lobbyId} />;
  }

  if (isPlayer) {
    return <LobbyPlayerView lobbyId={lobbyId} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 text-center">
      <p>Вы в лобби как зритель. Станьте игроком, чтобы участвовать.</p>
    </div>
  );
}
