import React, { useEffect, useState } from 'react';
import { lobbyApiService } from '@/app/services/api/lobby'; // Путь к вашему lobby.ts
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'; // Компоненты UI из вашего примера
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { LobbyPreview } from '@/app/services/types/lobby';
import { ArrowLeft, Save, Loader2, RefreshCw, Crown, Star, Users, User, UserPlus, MessageCircle, Heart, Zap, Plus, Play, Eye, MapPin, Clock } from "lucide-react";
import { useAuth } from '@/app/services/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CreateLobbyModal from './CreateLobbyModal';
import { useRouter } from 'next/navigation';
import SessionCard from '../session/SessionCard';
import { GameSessionPreview } from '@/app/services/types/session';
import { cn } from '@/lib/utils';


interface LobbyListProps {
  section: string
  sessions: GameSessionPreview[]
  onRefreshSessions?: () => void | Promise<void>
}

export default function LobbyList({ section, sessions, onRefreshSessions }: LobbyListProps) {
  const { state } = useAuth();
  const { user } = state;
  const [lobbies, setLobbies] = useState<LobbyPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Без этого «лобби пока нет» и «бэкенд лежит» выглядели для пользователя
  // одинаково: ошибка уходила в консоль, а список просто оставался пустым.
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchLobbies = async (background = false) => {
    try {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await lobbyApiService.getLobbies();
      setLobbies(data || []);
    } catch (err) {
      console.error('API error:', err);
      setError(err instanceof Error ? err.message : 'Не удалось загрузить список лобби');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([
      fetchLobbies(true),
      onRefreshSessions ? Promise.resolve(onRefreshSessions()) : Promise.resolve(),
    ]);
  };

  useEffect(() => {
    fetchLobbies();
  }, []);

  if (loading && lobbies.length === 0 && !error) {
    return (
      <TabsContent value={section} className="space-y-6">
        <div className="text-center py-8">Загрузка лобби...</div>
      </TabsContent>
    );
  }

  const handleNewLobby = (_newLobby: unknown) => {
    void fetchLobbies(true);
  };


  const goToLobby = (id: string) => {
    router.push(`/lobby/${id}`);
  };

  // Мастер и уже вошедшие участники заходят и в заполненное лобби.
  const isFull = (lobby: LobbyPreview) =>
    lobby.player_count >= lobby.max_players &&
    lobby.master_id !== user?.id &&
    !lobby.member_ids.includes(user?.id ?? '');

  return (
    <TabsContent value={section} className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">Активные подходы</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => void refreshAll()}
          className="border-gray-600 shrink-0"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
          Обновить
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Доступные лобби</h2>
        <CreateLobbyModal onLobbyCreated={handleNewLobby} />
      </div>

      {error && (
        <Card className="bg-red-950/40 border-red-800">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-red-200 font-medium">Не удалось загрузить лобби</p>
              <p className="text-sm text-red-300/80">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void fetchLobbies(true)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Повторить
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && lobbies.length === 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-8 text-center text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="text-white">Доступных лобби нет</p>
            <p className="text-sm mt-1">
              Новое лобби создаётся закрытым: откройте его для всех или пригласите игроков поимённо.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lobbies.map((lobby) => (
          <Card 
            key={lobby.id}
            className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-all duration-300 h-full"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{lobby.name}</CardTitle>
                {lobby.is_open ? null : (
                  <Badge variant="secondary" className="shrink-0">
                    {lobby.is_invited ? 'Вас пригласили' : 'Закрыто'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-400">{lobby.scenario_name || "Без описания"}</p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>Мастер: {lobby.master_name}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>
                    {lobby.player_count}/{lobby.max_players} игроков
                  </span>
                </div>
                {/* {lobby.startTime && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{lobby.startTime}</span>
                  </div>
                )} */}
              </div>


              {/* {lobby.tags && lobby.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {lobby.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )} */}

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1">
                  <Eye className="w-4 h-4 mr-2" />
                  Подробнее
                </Button>
                <Button 
                  size="sm" 
                  className="w-full flex-1"
                  disabled={isFull(lobby)}
                  onClick={() => { goToLobby(lobby.id); }}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isFull(lobby) ? "Заполнена" : "Присоединиться"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TabsContent>
  );
};
