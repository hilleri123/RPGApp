'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scenario } from "@/app/services/types2";
import { scenariosApiService } from '@/app/services/api/scenario';
import { launchedScenariosApi } from '@/app/services/api/launchedScenarios';
import { campaignsApiService } from '@/app/services/api/campaign';
import { LaunchedScenario } from '@/app/services/types/launchedScenario';
import { Campaign } from '@/app/services/types/campaign';
import { ScenarioParty } from '@/app/services/types/launchedScenario';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useLobbyWebSocket } from '@/app/services/hooks/useLobbyWebSocket';
import { PLAY_TERMS } from '@/app/services/types/playTerms';
import { toast } from 'sonner';


interface ScenarioInfoProps {
  lobbyId: string;
}

export const ScenarioInfo = ({ lobbyId }: ScenarioInfoProps) => { 
  const {
    lobby,
    isMaster,
    masterSelectScenario,
    masterSelectLaunchedScenario,
    masterSelectCampaign,
    masterSelectParty,
  } = useLobbyWebSocket(lobbyId);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [launchedScenarios, setLaunchedScenarios] = useState<LaunchedScenario[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [parties, setParties] = useState<ScenarioParty[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLaunchedDialogOpen, setIsLaunchedDialogOpen] = useState(false);
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const [scenarioList, launchedList, campaignList] = await Promise.all([
        scenariosApiService.getScenarios(),
        launchedScenariosApi.list(),
        campaignsApiService.listCampaigns().catch(() => [] as Campaign[]),
      ]);
      setScenarios(scenarioList.filter((s) => !s.is_session_snapshot));
      setLaunchedScenarios(launchedList);
      setCampaigns(campaignList);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (isLaunchedDialogOpen) {
      void loadLists();
    }
  }, [isLaunchedDialogOpen, loadLists]);

  useEffect(() => {
    const launchedId = lobby.launched_scenario_id;
    if (!launchedId) {
      setParties([]);
      return;
    }
    void launchedScenariosApi.listParties(launchedId).then(setParties).catch(() => setParties([]));
  }, [lobby.launched_scenario_id]);

  const selectedCampaign = campaigns.find((c) => c.id === lobby.campaign_id);
  const selectedLaunched = launchedScenarios.find((ls) => ls.id === lobby.launched_scenario_id);
  const selectedHasActiveApproach = Boolean(selectedLaunched?.active_approach_session_id);

  const handleSelectCampaign = (c: Campaign) => {
    masterSelectCampaign(c.id);
    setIsCampaignDialogOpen(false);
  };

  const handleSelectLaunched = (ls: LaunchedScenario) => {
    if (ls.active_approach_session_id) {
      toast.error('У этого сценария уже идёт активный подход. Завершите текущую сессию или выберите другой.');
      return;
    }
    masterSelectLaunchedScenario(ls.id);
    setIsLaunchedDialogOpen(false);
  };

  return (
    <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span>Сценарий</span>
          {lobby.campaign_id ? (
            <Badge variant="outline" className="ml-auto text-violet-300 border-violet-500">
              Кампания
            </Badge>
          ) : null}
          {lobby.launched_scenario_id ? (
            <Badge variant="outline" className={`${lobby.campaign_id ? '' : 'ml-auto'} text-amber-300 border-amber-500`}>
              {PLAY_TERMS.launchedScenario}
            </Badge>
          ) : null}
          {lobby.scenario && (
            <Badge variant="secondary" className={lobby.launched_scenario_id ? '' : 'ml-auto'}>
              {lobby.scenario.name}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {lobby.scenario ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{lobby.scenario.name}</h3>
              {selectedCampaign ? (
                <p className="text-sm text-violet-300 mb-2">
                  Кампания «{selectedCampaign.name}» · эпизод{' '}
                  {selectedCampaign.current_step_index + 1}/{selectedCampaign.scenarios.length}
                  {selectedCampaign.has_carryover ? ' · перенос персонажей' : ''}
                </p>
              ) : null}
              <p className="text-gray-300">{lobby.scenario.intro}</p>
            </div>
            {parties.length > 1 && isMaster ? (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-400">Партия:</span>
                {parties.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={lobby.party_id === p.id ? 'default' : 'outline'}
                    onClick={() => masterSelectParty(p.id)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            ) : null}
            {selectedHasActiveApproach && selectedLaunched?.active_approach_session_id ? (
              <div className="rounded-md border border-red-700/50 bg-red-950/40 px-3 py-2 text-sm text-red-100">
                Активный подход уже идёт.{' '}
                <Link
                  href={`/session/${selectedLaunched.active_approach_session_id}`}
                  className="underline hover:text-white"
                >
                  Открыть сессию
                </Link>
                {' '}или выберите другой сценарий.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-400">Сценарий не выбран</p>
            {isMaster && (
              <p className="text-sm text-gray-500 mt-2">
                Выберите prep-сценарий или запущенный для начала игры
              </p>
            )}
          </div>
        )}
      </CardContent>

      {isMaster && (
        <CardFooter className="justify-end border-t border-gray-700 pt-4 gap-2 flex-wrap">
          <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-violet-600 text-violet-200 hover:bg-violet-950">
                {lobby.campaign_id ? 'Сменить кампанию' : 'Кампания'}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-white">Кампания</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-3">
                  {campaigns.map((c) => (
                    <Card
                      key={c.id}
                      className="bg-gray-750 border-gray-700 hover:border-violet-500 cursor-pointer"
                      onClick={() => handleSelectCampaign(c)}
                    >
                      <CardContent className="p-4">
                        <h3 className="font-bold text-white">{c.name}</h3>
                        <p className="text-xs text-gray-400 mt-1">
                          Эпизод {c.current_step_index + 1}/{c.scenarios.length}
                          {c.launched_scenario_id ? ' · мир запущен' : ''}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {campaigns.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      Нет кампаний.{' '}
                      <Link href="/campaigns/new" className="text-violet-400 underline">
                        Создать
                      </Link>
                    </p>
                  ) : null}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <Dialog open={isLaunchedDialogOpen} onOpenChange={setIsLaunchedDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-amber-600 text-amber-200 hover:bg-amber-950">
                {lobby.launched_scenario_id ? 'Сменить запущенный' : 'Выбрать запущенный'}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-white">{PLAY_TERMS.launchedScenario}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-3">
                  {launchedScenarios.map((ls) => {
                    const busy = Boolean(ls.active_approach_session_id);
                    return (
                      <Card
                        key={ls.id}
                        className={`bg-gray-750 border-gray-700 ${
                          busy
                            ? 'opacity-60 cursor-not-allowed border-red-900/50'
                            : 'hover:border-amber-500 cursor-pointer'
                        }`}
                        onClick={() => !busy && handleSelectLaunched(ls)}
                      >
                        <CardContent className="p-4">
                          <h3 className="font-bold text-white">{ls.name}</h3>
                          <p className="text-xs text-gray-400 mt-1">
                            {ls.lifecycle_status === 'running' ? 'В игре' : ls.lifecycle_status}
                            {busy ? ' · активный подход' : ''}
                          </p>
                          {busy && ls.active_approach_session_id ? (
                            <Link
                              href={`/session/${ls.active_approach_session_id}`}
                              className="text-xs text-red-300 underline mt-1 inline-block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Открыть текущую сессию
                            </Link>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {launchedScenarios.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">Нет запущенных сценариев</p>
                  ) : null}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-blue-600 hover:bg-blue-700 text-white">
                {lobby.scenario && !lobby.launched_scenario_id ? 'Сменить сценарий' : 'Выбрать prep-сценарий'}
              </Button>
            </DialogTrigger>
            
            <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-white">Prep-сценарий (разовая игра)</DialogTitle>
              </DialogHeader>
              
              <ScrollArea className="max-h-[60vh]">
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full rounded-lg bg-gray-700" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {scenarios.map(scenario => (
                      <Card 
                        key={scenario.id} 
                        className="bg-gray-750 border-gray-700 hover:border-blue-500 transition-colors cursor-pointer"
                        onClick={() => {
                          masterSelectScenario(scenario.id);
                          setIsDialogOpen(false);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-bold text-white">{scenario.name}</h3>
                              <p className="text-sm text-gray-400 line-clamp-2 mt-1">
                                {scenario.intro}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardFooter>
      )}
    </Card>
  );
}
