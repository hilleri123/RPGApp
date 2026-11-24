'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import Header from '@/app/components/layout/Header';
import { RequireAuth } from '@/app/components/auth/RequireAuth';
import { Button } from '@/components/ui/button';
import { playerCabinetApi, PlayedGame } from '@/app/services/api/playerCabinet';

function when(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function GamesPage() {
  const [items, setItems] = useState<PlayedGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void playerCabinetApi.games()
      .then((result) => setItems(result.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section="Игры" />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <p className="text-sm text-gray-400">Игры, которые вам вели.</p>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-500 py-12">Пока нет игр, которые вам вели</div>
        ) : (
          <div className="grid gap-3">
            {items.map((game) => (
              <div key={game.id} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{game.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {game.character_name ? (
                        <span>
                          Персонаж{' '}
                          <span style={game.color ? { color: game.color } : undefined}>{game.character_name}</span>
                        </span>
                      ) : null}
                      {game.character_name && game.master_name ? ' · ' : ''}
                      {game.master_name ? `мастер ${game.master_name}` : ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {when(game.played_at)}
                      {game.evenings.length > 1 ? ` · ${game.evenings.length} вечеров` : ''}
                    </div>
                  </div>
                  {game.active_session_id ? (
                    <Link href={`/session/${game.active_session_id}`}>
                      <Button size="sm">В сессию</Button>
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function PlayerGamesPage() {
  return (
    <RequireAuth>
      <GamesPage />
    </RequireAuth>
  );
}
