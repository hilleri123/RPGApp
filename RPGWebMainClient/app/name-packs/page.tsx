'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Header from '@/app/components/layout/Header';
import { namePacksApiService, type NamePack } from '@/app/services/api/namePacks';
import { EntityPackTagBadges } from '@/app/components/entity-packs/EntityPackTagBadges';
import { Loader2, ChevronRight, Sparkles } from 'lucide-react';

export default function NamePacksPage() {
  const router = useRouter();
  const [packs, setPacks] = useState<NamePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPacks(await namePacksApiService.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return packs.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [packs, search]);

  const createPack = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const pack = await namePacksApiService.createPack(newName.trim());
      setNewName('');
      await load();
      router.push(`/name-packs/${pack.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section="Паки имён" />
      <main className="container mx-auto px-4 py-6 space-y-5">
        <p className="text-sm text-gray-400 max-w-3xl">
          Нарративные наборы имён — не привязаны к системе правил. Подключайте нужные паки в настройках сценария;
          сборщик появится в диалогах NPC и персонажей.
        </p>

        <div className="flex flex-wrap gap-4 items-end">
          <Input placeholder="Поиск…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        </div>

        <div className="flex gap-2 max-w-md">
          <Input placeholder="Новый пак…" value={newName} onChange={(e) => setNewName(e.target.value)} disabled={busy} />
          <Button onClick={() => void createPack()} disabled={!newName.trim() || busy}>
            Создать
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">Паков пока нет.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((pack) => (
              <li key={pack.id}>
                <Link
                  href={`/name-packs/${pack.id}`}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10"
                >
                  <Sparkles className="w-5 h-5 text-violet-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{pack.name}</div>
                    <EntityPackTagBadges tags={pack.tags ?? []} className="mt-1" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
