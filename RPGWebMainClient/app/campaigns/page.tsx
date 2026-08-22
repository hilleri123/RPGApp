'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Header from '@/app/components/layout/Header';
import { campaignsApiService } from '@/app/services/api/campaign';
import { Campaign } from '@/app/services/types/campaign';
import { lobbyApiService } from '@/app/services/api/lobby';
import { Loader2, Plus, ChevronRight, Play, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function CampaignsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await campaignsApiService.listCampaigns());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = items.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const openLobby = async (campaign: Campaign) => {
    setBusyId(campaign.id);
    try {
      const lobby = await lobbyApiService.createLobby({
        name: campaign.name,
        max_players: 8,
      });
      router.push(`/lobby/${lobby.id}?campaign_id=${campaign.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const continueCampaign = async (campaign: Campaign) => {
    setBusyId(campaign.id);
    try {
      const res = await campaignsApiService.continueCampaign(campaign.id);
      router.push(`/session/${res.session_id}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section="Кампании" />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <p className="text-sm text-gray-400 max-w-2xl">
            Многошаговые истории с общим миром: один запущенный сценарий живёт между подходами и
            партиями, персонажи и мир переносятся между эпизодами.
          </p>
          <Link href="/campaigns/new">
            <Button>
              <Plus className="w-4 h-4 mr-1" /> Новая кампания
            </Button>
          </Link>
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск…"
          className="max-w-xs"
        />

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((c) => {
              const total = c.scenarios.length;
              const step = Math.min(c.current_step_index + 1, total || 1);
              return (
                <div
                  key={c.id}
                  className="border border-gray-700 rounded-lg p-4 bg-gray-950/60 flex flex-wrap gap-3 items-center justify-between"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/campaigns/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {!c.is_active ? (
                        <Badge variant="outline" className="text-gray-400">
                          Архив
                        </Badge>
                      ) : null}
                      {c.launched_scenario_id ? (
                        <Badge variant="outline" className="text-amber-300 border-amber-600">
                          Мир запущен
                        </Badge>
                      ) : null}
                      {c.has_carryover ? (
                        <Badge variant="outline" className="text-violet-300 border-violet-600">
                          Есть перенос
                        </Badge>
                      ) : null}
                    </div>
                    {c.description ? (
                      <p className="text-sm text-gray-400 line-clamp-2">{c.description}</p>
                    ) : null}
                    <p className="text-xs text-gray-500">
                      Эпизод {step}{total ? ` / ${total}` : ''}
                      {c.scenarios[step - 1]?.scenario_name
                        ? ` · ${c.scenarios[step - 1].scenario_name}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {c.can_continue ? (
                      <Button
                        size="sm"
                        onClick={() => void continueCampaign(c)}
                        disabled={busyId === c.id}
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Продолжить
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void openLobby(c)}
                        disabled={busyId === c.id || !c.is_active || total === 0}
                      >
                        <Layers className="w-3.5 h-3.5 mr-1" /> Лобби
                      </Button>
                    )}
                    <Link href={`/campaigns/${c.id}`}>
                      <Button size="sm" variant="outline">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                Кампаний пока нет.{' '}
                <Link href="/campaigns/new" className="text-blue-400 underline">
                  Создать первую
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
