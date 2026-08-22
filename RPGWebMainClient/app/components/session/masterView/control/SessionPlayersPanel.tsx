'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserCard } from '@/app/components/common/UserCard';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import type { Player } from '@/app/services/types/lobby';
import { openPlayerMirror } from '@/app/components/session/masterView/playerMirror/openPlayerMirror';

function normalizeHex(value: string | null | undefined): string {
  if (!value) return '#000000';
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  return '#000000';
}

function SessionPlayerCard({
  sessionId,
  player,
  characters,
  assignedIds,
}: {
  sessionId: string;
  player: Player;
  characters: any[];
  assignedIds: Set<string>;
}) {
  const {
    masterKickPlayer,
    masterDeselectPlayerCharacter,
    masterAssignPlayerCharacter,
    masterSetPlayerColor,
  } = useSessionWebSocket(sessionId);

  const [colorOpen, setColorOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [draftColor, setDraftColor] = useState(normalizeHex(player.color));

  useEffect(() => {
    setDraftColor(normalizeHex(player.color));
  }, [player.color]);

  const selectedCharacter = useMemo(() => {
    if (!player.character_id) return null;
    return characters.find((c) => String(c.id) === String(player.character_id)) ?? player.character ?? null;
  }, [characters, player.character_id, player.character]);

  const availableCharacters = useMemo(
    () =>
      characters.filter((c) => {
        const id = String(c.id);
        if (player.character_id && id === String(player.character_id)) return true;
        return !assignedIds.has(id);
      }),
    [characters, assignedIds, player.character_id],
  );

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-3 space-y-3">
      <div className="flex items-start gap-3">
        <UserCard user={player.user} color={player.color} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate">{player.name || player.user?.full_name}</div>
          <div className="text-xs text-gray-400 truncate">{player.user?.email}</div>
        </div>
      </div>

      {selectedCharacter ? (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-gray-400 mb-1">Персонаж</div>
          <div className="text-white font-medium truncate">{selectedCharacter.name}</div>
          {selectedCharacter.short_desc ? (
            <div className="text-xs text-gray-400 mt-1 line-clamp-2">{selectedCharacter.short_desc}</div>
          ) : null}
        </div>
      ) : (
        <Badge variant="secondary" className="bg-amber-500/15 text-amber-200 border-amber-500/30">
          Персонаж не выбран
        </Badge>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!selectedCharacter || !player.user?.id}
          title={
            !selectedCharacter
              ? 'Сначала назначьте персонажа'
              : 'Открыть UI игрока в новом окне (только просмотр)'
          }
          onClick={() => {
            const uid = String(player.user?.id ?? '');
            if (!uid) {
              toast.error('У игрока нет user id');
              return;
            }
            const win = openPlayerMirror(sessionId, uid);
            if (!win) {
              toast.error('Не удалось открыть окно — разрешите pop-up');
            }
          }}
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          Глаза игрока
        </Button>
        <Button variant="outline" size="sm" onClick={() => setColorOpen(true)}>
          Цвет
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPickOpen(true)}>
          {selectedCharacter ? 'Сменить персонажа' : 'Назначить персонажа'}
        </Button>
        {selectedCharacter ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              masterDeselectPlayerCharacter(String(player.id));
              toast.success('Персонаж сброшен');
            }}
          >
            Сбросить персонажа
          </Button>
        ) : null}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            masterKickPlayer(String(player.id));
            toast.success('Игрок удалён из подхода');
          }}
        >
          Кикнуть
        </Button>
      </div>

      <Dialog open={colorOpen} onOpenChange={setColorOpen}>
        <DialogContent className="bg-gray-900 border border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Цвет игрока</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Input
              type="color"
              value={normalizeHex(draftColor)}
              onChange={(e) => setDraftColor(normalizeHex(e.target.value))}
              className="h-12 w-16 p-1"
            />
            <div className="font-mono text-sm">{normalizeHex(draftColor)}</div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setColorOpen(false)}>Отмена</Button>
            <Button
              onClick={() => {
                masterSetPlayerColor(String(player.id), normalizeHex(draftColor));
                toast.success('Цвет обновлён');
                setColorOpen(false);
              }}
            >
              Применить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="bg-gray-900 border border-white/10 text-white max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Персонажи сессии</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
            {availableCharacters.map((ch) => (
              <li key={String(ch.id)}>
                <button
                  type="button"
                  className="w-full text-left rounded-lg p-3 bg-white/5 hover:bg-white/10 transition-colors"
                  onClick={() => {
                    masterAssignPlayerCharacter(String(player.id), String(ch.id));
                    toast.success(`Назначен персонаж «${ch.name}»`);
                    setPickOpen(false);
                  }}
                >
                  <div className="font-medium text-sm">{ch.name}</div>
                  {ch.short_desc ? <div className="text-xs text-gray-400 truncate">{ch.short_desc}</div> : null}
                </button>
              </li>
            ))}
            {availableCharacters.length === 0 && (
              <li className="text-sm text-gray-400 text-center py-4">Нет свободных персонажей</li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SessionPlayersPanel({ sessionId }: { sessionId: string }) {
  const { session, characters } = useSessionWebSocket(sessionId);
  const players: Player[] = session?.players ?? [];

  const assignedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of players) {
      if (p.character_id) ids.add(String(p.character_id));
    }
    return ids;
  }, [players]);

  if (!players.length) {
    return <p className="text-sm text-gray-400">В подходе пока нет игроков.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Управление игроками: цвет на карте, назначение и сброс персонажа, удаление из подхода.
      </p>
      {players.map((player) => (
        <SessionPlayerCard
          key={String(player.id)}
          sessionId={sessionId}
          player={player}
          characters={characters ?? []}
          assignedIds={assignedIds}
        />
      ))}
    </div>
  );
}
