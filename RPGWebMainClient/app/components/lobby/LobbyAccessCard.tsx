'use client';

import { useEffect, useState } from 'react';
import { Loader2, Lock, LockOpen, Search, Send, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { lobbyApiService } from '@/app/services/api/lobby';
import { useLobbyWebSocket } from '@/app/services/hooks/useLobbyWebSocket';
import type { LobbyUserHit } from '@/app/services/types/lobby';
import { cn } from '@/lib/utils';

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      title={online ? 'В сети' : 'Не в сети'}
      className={cn('inline-block w-2.5 h-2.5 rounded-full shrink-0', online ? 'bg-green-500' : 'bg-gray-500')}
    />
  );
}

/** Доступ к лобби (только мастер): открыть всем или пригласить игроков поимённо. */
export function LobbyAccessCard({ lobbyId }: { lobbyId: string }) {
  const { lobby, isUserOnline, masterSetLobbyOpen, masterInviteUser, masterUninviteUser } =
    useLobbyWebSocket(lobbyId);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<LobbyUserHit[]>([]);
  const [searching, setSearching] = useState(false);

  const isOpen = !!lobby?.is_open;
  const invited = lobby?.invited_users || [];
  const playerIds = new Set((lobby?.players || []).map((p) => String(p.user?.id)));

  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      lobbyApiService
        .searchUsersToInvite(lobbyId, q)
        .then((res) => {
          if (!cancelled) setHits(res);
        })
        .catch(() => {
          if (!cancelled) {
            setHits([]);
            toast.error('Не удалось выполнить поиск');
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Список приглашённых меняется по WebSocket: повторяем поиск, чтобы убрать уже добавленных.
  }, [query, lobbyId, invited.length]);

  const invite = (hit: LobbyUserHit) => {
    masterInviteUser(hit.id);
    setHits((prev) => prev.filter((h) => h.id !== hit.id));
    toast.success(
      hit.has_telegram
        ? `Приглашение отправлено в Telegram: ${hit.full_name || hit.tg}`
        : `${hit.full_name || hit.tg} приглашён(а), но Telegram не привязан`,
    );
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {isOpen ? <LockOpen className="w-5 h-5 text-green-400" /> : <Lock className="w-5 h-5 text-amber-400" />}
            Доступ к лобби
          </CardTitle>
          <Badge variant={isOpen ? 'default' : 'secondary'}>{isOpen ? 'Открыто всем' : 'Закрыто'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between gap-3 rounded-md border border-gray-700 bg-gray-900/40 p-3">
          <span className="text-sm text-gray-200">
            Открыть для всех
            <span className="block text-xs text-gray-400">
              Лобби появится в общем списке, зайти сможет любой.
            </span>
          </span>
          <Switch checked={isOpen} onCheckedChange={(v) => masterSetLobbyOpen(v)} />
        </label>

        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-200">Пригласить игрока</div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Имя или @telegram (от 2 символов)"
              className="pl-8 bg-gray-900 border-gray-700"
            />
            {searching ? <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-gray-400" /> : null}
          </div>

          {hits.length > 0 ? (
            <ul className="rounded-md border border-gray-700 divide-y divide-gray-700">
              {hits.map((hit) => (
                <li key={hit.id} className="flex items-center justify-between gap-2 p-2">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{hit.full_name || hit.tg || hit.id}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {hit.tg ? `@${hit.tg}` : 'без ника'}
                      {hit.has_telegram ? '' : ' · Telegram не привязан'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={playerIds.has(hit.id)}
                    onClick={() => invite(hit)}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Пригласить
                  </Button>
                </li>
              ))}
            </ul>
          ) : query.trim().replace(/^@/, '').length >= 2 && !searching ? (
            <p className="text-xs text-gray-500">Никого не нашли</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-200">Приглашены ({invited.length})</div>
          {invited.length === 0 ? (
            <p className="text-xs text-gray-500">Пока никого. Закрытое лобби не видно остальным.</p>
          ) : (
            <ul className="rounded-md border border-gray-700 divide-y divide-gray-700">
              {invited.map((u) => {
                const online = isUserOnline(u.id);
                return (
                  <li key={u.id} className="flex items-center justify-between gap-2 p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <OnlineDot online={online} />
                      <span className="text-sm text-white truncate">{u.full_name || u.email}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {playerIds.has(String(u.id)) ? 'в лобби' : online ? 'на странице' : 'не в сети'}
                      </span>
                      {u.telegram_id ? (
                        <Send className="w-3 h-3 text-sky-400 shrink-0" aria-label="Приглашение ушло в Telegram" />
                      ) : (
                        <span className="text-[10px] text-amber-400 shrink-0">без Telegram</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Убрать приглашение (игрока, уже вошедшего в лобби, это выгонит)"
                      onClick={() => masterUninviteUser(u.id)}
                    >
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
