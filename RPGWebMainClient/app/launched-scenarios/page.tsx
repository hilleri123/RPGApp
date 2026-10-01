'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayLifecycleGuide } from '@/app/components/common/PlayLifecycleGuide';
import Header from '@/app/components/layout/Header';
import { launchedScenariosApi } from '@/app/services/api/launchedScenarios';
import { LaunchedScenario } from '@/app/services/types/launchedScenario';
import { PLAY_TERMS } from '@/app/services/types/playTerms';
import { Loader2, Pencil, Play, Archive } from 'lucide-react';

export default function LaunchedScenariosPage() {
  const router = useRouter();
  const [items, setItems] = useState<LaunchedScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setItems(await launchedScenariosApi.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = items.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const handleClose = async (id: string) => {
    if (!confirm('Закрыть запущенный сценарий? Активный подход должен быть завершён.')) return;
    await launchedScenariosApi.close(id);
    await load();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section={PLAY_TERMS.launchedScenario} />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <p className="text-sm text-gray-400">
          Живые копии сценариев между подходами и партиями. Исходный сценарий (prep) можно редактировать параллельно.
        </p>
        <PlayLifecycleGuide />
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск…"
            className="max-w-xs"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="border border-gray-700 rounded-lg p-4 bg-gray-950/60 flex flex-wrap gap-3 items-center justify-between"
              >
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {s.lifecycle_status === 'running' ? 'В игре' : s.lifecycle_status}
                    {s.source_scenario_id ? ` · prep: ${s.source_scenario_id.slice(0, 8)}…` : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/scenarios/${s.id}`}>
                    <Button size="sm" variant="secondary">
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Редактировать
                    </Button>
                  </Link>
                  {s.source_scenario_id ? (
                    <Link href={`/scenarios/${s.source_scenario_id}`}>
                      <Button size="sm" variant="outline">
                        Исходник
                      </Button>
                    </Link>
                  ) : null}
                  <Button size="sm" variant="destructive" onClick={() => void handleClose(s.id)}>
                    <Archive className="w-3.5 h-3.5 mr-1" /> Закрыть
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 ? (
              <div className="text-center text-gray-500 py-12">Запущенных сценариев пока нет</div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
