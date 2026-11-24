'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Header from '@/app/components/layout/Header';
import { RequireAuth } from '@/app/components/auth/RequireAuth';
import { playerCabinetApi, MyCharacter } from '@/app/services/api/playerCabinet';

const FALLBACK = '/static/img/npc-avatar-default.png';

function CharactersPage() {
  const [items, setItems] = useState<MyCharacter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void playerCabinetApi.characters()
      .then((result) => setItems(result.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section="Персонажи" />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <p className="text-sm text-gray-400">Персонажи, за которых вы играли.</p>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-500 py-12">Пока нет персонажей</div>
        ) : (
          <div className="grid gap-3">
            {items.map((character) => {
              const portrait = character.img_url || character.icon_url || FALLBACK;
              return (
                <div key={character.id} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60 flex gap-3">
                  <img src={portrait} alt="" className="w-14 h-14 rounded-md object-cover bg-gray-900 border border-gray-700" />
                  <div className="min-w-0">
                    <div className="font-medium">{character.name}</div>
                    {character.short_desc ? (
                      <div className="text-sm text-gray-400 mt-1">{character.short_desc}</div>
                    ) : null}
                    {character.games.length ? (
                      <div className="text-xs text-gray-500 mt-1">
                        {character.games.map((game) => game.name).join(' · ')}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function PlayerCharactersPage() {
  return (
    <RequireAuth>
      <CharactersPage />
    </RequireAuth>
  );
}
