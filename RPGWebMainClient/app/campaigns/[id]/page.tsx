'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Header from '@/app/components/layout/Header';
import { campaignsApiService } from '@/app/services/api/campaign';
import { scenariosApiService } from '@/app/services/api/scenario';
import { launchedScenariosApi } from '@/app/services/api/launchedScenarios';
import { lobbyApiService } from '@/app/services/api/lobby';
import { Campaign, CampaignScenarioLink } from '@/app/services/types/campaign';
import { Scenario } from '@/app/services/types2';
import { ScenarioParty } from '@/app/services/types/launchedScenario';
import { SessionHistoryList } from '@/app/components/profile/SessionHistoryList';
import { CampaignProfile } from '@/app/services/types/sessionDispatch';
import {
  Loader2,
  ArrowLeft,
  Play,
  Layers,
  Pencil,
  Trash2,
  Plus,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [profile, setProfile] = useState<CampaignProfile | null>(null);
  const [parties, setParties] = useState<ScenarioParty[]>([]);
  const [allScenarios, setAllScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p, sc] = await Promise.all([
        campaignsApiService.getCampaign(id),
        campaignsApiService.getProfile(),
        scenariosApiService.getScenarios({ limit: 500 }),
      ]);
      setCampaign(c);
      setProfile(p);
      setEditName(c.name);
      setEditDesc(c.description ?? '');
      setAllScenarios(sc.filter((s) => !s.is_session_snapshot));
      if (c.launched_scenario_id) {
        setParties(await launchedScenariosApi.listParties(c.launched_scenario_id));
      } else {
        setParties([]);
      }
    } catch {
      toast.error('Кампания не найдена');
      router.push('/campaigns');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const history = (profile?.session_history ?? []).filter((h) => h.campaign_id === id);

  const saveMeta = async () => {
    if (!campaign) return;
    setBusy(true);
    try {
      const updated = await campaignsApiService.updateCampaign(campaign.id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
      });
      setCampaign(updated);
      toast.success('Сохранено');
    } finally {
      setBusy(false);
    }
  };

  const updateScenarios = async (scenarios: CampaignScenarioLink[]) => {
    if (!campaign) return;
    setBusy(true);
    try {
      const updated = await campaignsApiService.updateCampaign(campaign.id, { scenarios });
      setCampaign(updated);
    } finally {
      setBusy(false);
    }
  };

  const addEpisode = (scenarioId: string) => {
    if (!campaign) return;
    if (campaign.scenarios.some((s) => s.scenario_id === scenarioId)) return;
    const next = [
      ...campaign.scenarios.map((s) => ({
        scenario_id: s.scenario_id,
        order_num: s.order_num,
        title_override: s.title_override,
      })),
      { scenario_id: scenarioId, order_num: campaign.scenarios.length },
    ];
    void updateScenarios(next);
    setAddDialogOpen(false);
  };

  const removeEpisode = (scenarioId: string) => {
    if (!campaign || campaign.launched_scenario_id) {
      toast.error('Нельзя менять эпизоды после запуска мира');
      return;
    }
    const next = campaign.scenarios
      .filter((s) => s.scenario_id !== scenarioId)
      .map((s, i) => ({ scenario_id: s.scenario_id, order_num: i, title_override: s.title_override }));
    void updateScenarios(next);
  };

  const openLobby = async () => {
    if (!campaign) return;
    setBusy(true);
    try {
      const lobby = await lobbyApiService.createLobby({
        name: campaign.name,
        max_players: 8,
      });
      router.push(`/lobby/${lobby.id}?campaign_id=${campaign.id}`);
    } finally {
      setBusy(false);
    }
  };

  const continueCampaign = async () => {
    if (!campaign) return;
    setBusy(true);
    try {
      const res = await campaignsApiService.continueCampaign(campaign.id);
      router.push(`/session/${res.session_id}`);
    } finally {
      setBusy(false);
    }
  };

  const deleteCampaign = async () => {
    if (!campaign || !confirm('Удалить кампанию?')) return;
    await campaignsApiService.deleteCampaign(campaign.id);
    router.push('/campaigns');
  };

  const createParty = async () => {
    if (!campaign?.launched_scenario_id) return;
    const name = prompt('Название партии', `Партия ${parties.length + 1}`);
    if (!name?.trim()) return;
    const tag = `party:${name.trim().toLowerCase().replace(/\s+/g, '_')}`;
    const party = await launchedScenariosApi.createParty(campaign.launched_scenario_id, {
      name: name.trim(),
      filter_tags: [tag],
      sort_order: parties.length,
    });
    setParties((prev) => [...prev, party]);
  };

  if (loading || !campaign) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const total = campaign.scenarios.length;
  const current = Math.min(campaign.current_step_index, Math.max(total - 1, 0));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section={campaign.name} />
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        <Link href="/campaigns" className="text-sm text-gray-400 hover:text-white inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Кампании
        </Link>

        <div className="flex flex-wrap gap-2 items-center">
          {!campaign.is_active ? <Badge variant="outline">Архив</Badge> : null}
          {campaign.launched_scenario_id ? (
            <Badge className="bg-amber-900/50 text-amber-200 border-amber-700">Общий мир</Badge>
          ) : null}
          {campaign.has_carryover ? (
            <Badge className="bg-violet-900/50 text-violet-200 border-violet-700">Перенос состояния</Badge>
          ) : null}
          {campaign.can_continue ? (
            <Badge className="bg-green-900/50 text-green-200 border-green-700">Можно продолжить</Badge>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 border border-gray-700 rounded-lg p-4">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
            <Button size="sm" onClick={() => void saveMeta()} disabled={busy}>
              Сохранить
            </Button>
          </div>

          <div className="border border-gray-700 rounded-lg p-4 space-y-3">
            <h3 className="font-medium">Прогресс</h3>
            <p className="text-2xl font-bold">
              {total ? `${current + 1} / ${total}` : '—'}
            </p>
            <div className="flex gap-2 flex-wrap">
              {campaign.can_continue ? (
                <Button onClick={() => void continueCampaign()} disabled={busy}>
                  <Play className="w-4 h-4 mr-1" /> Продолжить эпизод
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => void openLobby()} disabled={busy || total === 0}>
                  <Layers className="w-4 h-4 mr-1" /> Открыть лобби
                </Button>
              )}
            </div>
          </div>
        </div>

        {campaign.launched_scenario_id ? (
          <section className="border border-amber-800/40 rounded-lg p-4 bg-amber-950/20 space-y-3">
            <h3 className="font-medium text-amber-100">Запущенный мир (общий для всех партий)</h3>
            <p className="text-sm text-gray-400">
              NPC, предметы и изменения сохраняются между подходами. Prep-сценарии эпизодов можно
              редактировать отдельно — мир живёт в запущенной копии.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Link href={`/scenarios/${campaign.launched_scenario_id}`}>
                <Button size="sm" variant="outline" className="border-amber-600">
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Редактировать мир
                </Button>
              </Link>
              <Link href="/launched-scenarios">
                <Button size="sm" variant="ghost">
                  Все запущенные
                </Button>
              </Link>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-1">
                  <Users className="w-4 h-4" /> Партии
                </h4>
                <Button size="sm" variant="outline" onClick={() => void createParty()}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Партия
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Сущности с тегом party:* видны только выбранной партии. Без тега — всем.
              </p>
              {parties.map((p) => (
                <div key={p.id} className="text-sm px-3 py-2 rounded bg-gray-900/80 border border-gray-700">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-gray-500 ml-2 text-xs">{p.filter_tags.join(', ')}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Эпизоды</h3>
            {!campaign.launched_scenario_id ? (
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Добавить
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-800 border-gray-700 max-h-[70vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Сценарий-эпизод</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1">
                    {allScenarios.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full text-left px-3 py-2 rounded hover:bg-gray-700"
                        onClick={() => addEpisode(s.id)}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
          <div className="space-y-2">
            {campaign.scenarios.map((ep, i) => (
              <div
                key={ep.id ?? ep.scenario_id}
                className={`flex items-center gap-3 px-3 py-2 rounded border ${
                  i === current
                    ? 'border-violet-600 bg-violet-950/30'
                    : i < campaign.current_step_index
                      ? 'border-gray-800 opacity-60'
                      : 'border-gray-700'
                }`}
              >
                <span className="text-xs text-gray-500 w-8">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {ep.title_override || ep.scenario_name || ep.scenario_id}
                  </div>
                  {i === current ? (
                    <span className="text-xs text-violet-300">Текущий эпизод</span>
                  ) : i < campaign.current_step_index ? (
                    <span className="text-xs text-gray-500">Пройден</span>
                  ) : null}
                </div>
                <Link href={`/scenarios/${ep.scenario_id}`}>
                  <Button size="sm" variant="ghost">
                    Prep
                  </Button>
                </Link>
                {!campaign.launched_scenario_id && campaign.scenarios.length > 1 ? (
                  <Button size="sm" variant="ghost" onClick={() => removeEpisode(ep.scenario_id)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {history.length > 0 ? (
          <section>
            <h3 className="font-medium mb-3">История подходов</h3>
            <SessionHistoryList items={history} />
          </section>
        ) : null}

        <Button variant="destructive" size="sm" onClick={() => void deleteCampaign()}>
          <Trash2 className="w-4 h-4 mr-1" /> Удалить кампанию
        </Button>
      </main>
    </div>
  );
}
