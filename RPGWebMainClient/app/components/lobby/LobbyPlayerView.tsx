'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, Loader2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import Header from '@/app/components/layout/Header';
import { Characters } from '@/app/components/lobby/Characters';
import { Players } from '@/app/components/lobby/Players';
import { useLobbyWebSocket } from '@/app/services/hooks/useLobbyWebSocket';
import { applicationApiService } from '@/app/services/api/application';
import type { ApplicationListItem } from '@/app/services/types2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeHex(value: string): string {
  if (!value) return '#000000';
  if (isHexColor(value)) return value.toLowerCase();
  return '#000000';
}

function ImportCharacterDialog({
  ruleIdStr,
  currentApplicationId,
  onSelect,
  fullWidth,
}: {
  ruleIdStr: string | null;
  currentApplicationId: string | null;
  onSelect: (applicationId: string) => void;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState<ApplicationListItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    applicationApiService
      .getList({ rule_id_str: ruleIdStr ?? undefined })
      .then((list) => setApps(list.filter((a) => a.status === 'approved')))
      .catch(() => toast.error('Не удалось загрузить заявки'))
      .finally(() => setLoading(false));
  }, [open, ruleIdStr]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={`gap-2 border-white/10 text-white/90 hover:text-white ${fullWidth ? 'w-full' : ''}`}
        >
          <UserPlus className="h-4 w-4 shrink-0" />
          {currentApplicationId ? 'Сменить персонажа' : 'Персонаж из заявки'}
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-gray-900 border border-white/10 text-white max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Мои одобренные персонажи</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        )}

        {!loading && apps.length === 0 && (
          <p className="text-white/50 text-sm py-4 text-center">
            Нет одобренных заявок{ruleIdStr ? ` для системы «${ruleIdStr}»` : ''}
          </p>
        )}

        {!loading && apps.length > 0 && (
          <ul className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
            {apps.map((app) => (
              <li key={app.id}>
                <button
                  type="button"
                  className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors
                    ${currentApplicationId === app.id
                      ? 'bg-blue-900/60 ring-1 ring-blue-500'
                      : 'bg-white/5 hover:bg-white/10'
                    }`}
                  onClick={() => {
                    onSelect(app.id);
                    toast.success(`Персонаж «${app.name}» выбран`);
                    setOpen(false);
                  }}
                >
                  {app.icon_url ? (
                    <img src={app.icon_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-white/10 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{app.name}</div>
                    {app.short_desc ? (
                      <div className="text-white/50 text-xs truncate">{app.short_desc}</div>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

type PlayerTab = 'characters' | 'players';

export function LobbyPlayerView({ lobbyId }: { lobbyId: string }) {
  const {
    lobby,
    connected,
    selfPlayer,
    playerReady,
    selectColor,
    playerSelectApplicationCharacter,
  } = useLobbyWebSocket(lobbyId);

  const hasCharacter = Boolean(selfPlayer?.character_id);
  const [tab, setTab] = useState<PlayerTab>('characters');

  const serverColor = normalizeHex((selfPlayer as any)?.color);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [draftColor, setDraftColor] = useState('#000000');
  const [colorDialogOpen, setColorDialogOpen] = useState(false);

  useEffect(() => {
    if (!serverColor) return;
    setSelectedColor(serverColor);
    setDraftColor(serverColor);
  }, [serverColor]);

  useEffect(() => {
    setTab(hasCharacter ? 'players' : 'characters');
  }, [hasCharacter]);

  const hasDraftChanges = useMemo(
    () => normalizeHex(draftColor) !== normalizeHex(selectedColor),
    [draftColor, selectedColor],
  );

  const ruleIdStr = (lobby?.scenario as any)?.rule_id_str ?? null;
  const currentCharacterId = selfPlayer?.character_id ? String(selfPlayer.character_id) : null;

  const selectedCharacterName = useMemo(() => {
    if (!currentCharacterId) return null;
    const all = [
      ...(lobby?.characters || []),
      ...(((lobby as any)?.imported_characters || []) as any[]),
    ];
    return all.find((c) => String(c.id) === currentCharacterId)?.name ?? null;
  }, [lobby, currentCharacterId]);

  const readyCount = (lobby?.players || []).filter((p) => p.is_ready).length;
  const playerCount = (lobby?.players || []).length;

  return (
    <div
      className="h-[100dvh] flex flex-col bg-gray-900 overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <Header section={`${lobby.name}${connected ? '' : ' · нет связи'}`} />

      {/* Компактная шапка */}
      <div className="shrink-0 px-4 py-2 border-b border-gray-800 bg-gray-900/95 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Сценарий</p>
            <p className="text-sm font-medium text-white truncate">
              {lobby.scenario?.name ?? 'Не выбран'}
            </p>
          </div>
          {hasCharacter ? (
            <Badge
              variant="secondary"
              className="shrink-0 bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
            >
              Персонаж выбран
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0 bg-amber-500/15 text-amber-200 border-amber-500/30">
              Выберите персонажа
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
          <span className="truncate">{lobby.master?.full_name ?? 'Мастер'}</span>
          <span className="text-gray-600">·</span>
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>
            {readyCount}/{playerCount} готовы
          </span>
        </div>
      </div>

      {/* Табы — занимают всё доступное пространство */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as PlayerTab)}
        className="flex flex-col flex-1 min-h-0 px-4 pt-2"
      >
        <TabsList className="w-full shrink-0 grid grid-cols-2 bg-gray-800 border border-gray-700 h-10">
          <TabsTrigger value="characters" className="text-sm data-[state=active]:bg-gray-700">
            Персонажи
          </TabsTrigger>
          <TabsTrigger value="players" className="text-sm data-[state=active]:bg-gray-700">
            Игроки
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="characters"
          className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden flex flex-col"
        >
          {lobby.scenario ? (
            <Characters lobbyId={lobbyId} variant="embedded" />
          ) : (
            <p className="text-sm text-gray-500 text-center py-12">Мастер ещё не выбрал сценарий</p>
          )}
        </TabsContent>

        <TabsContent
          value="players"
          className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden flex flex-col"
        >
          <Players lobbyId={lobbyId} variant="embedded" />
        </TabsContent>
      </Tabs>

      {/* Нижняя панель действий — всегда на экране */}
      <div
        className="shrink-0 border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm px-4 pt-3 space-y-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {selectedCharacterName ? (
          <p className="text-xs text-center text-gray-400 truncate">
            Ваш персонаж: <span className="text-white font-medium">{selectedCharacterName}</span>
          </p>
        ) : (
          <p className="text-xs text-center text-amber-300/90">Сначала выберите персонажа на вкладке выше</p>
        )}

        {lobby.scenario ? (
          <ImportCharacterDialog
            ruleIdStr={ruleIdStr}
            currentApplicationId={currentCharacterId}
            onSelect={playerSelectApplicationCharacter}
            fullWidth
          />
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-2 flex-1 min-w-0 rounded-lg border border-white/10 px-3 py-2 text-left"
            onClick={() => setColorDialogOpen(true)}
          >
            <div
              className="h-5 w-5 rounded border border-white/20 shrink-0"
              style={{ backgroundColor: selectedColor }}
            />
            <span className="text-xs text-gray-400 truncate">Цвет на карте</span>
          </button>

          <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
            <DialogContent className="bg-gray-900 border border-white/10 text-white">
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
                <Button variant="secondary" onClick={() => setColorDialogOpen(false)}>
                  Отмена
                </Button>
                <Button
                  disabled={!hasDraftChanges}
                  onClick={() => {
                    const next = normalizeHex(draftColor);
                    setSelectedColor(next);
                    selectColor(next);
                    toast.success('Цвет обновлён');
                    setColorDialogOpen(false);
                  }}
                >
                  Применить
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Button
          size="lg"
          disabled={!hasCharacter}
          className={`w-full h-12 text-base font-semibold ${
            selfPlayer?.is_ready
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
          onClick={() => playerReady(!selfPlayer?.is_ready)}
        >
          {selfPlayer?.is_ready ? 'Снять готовность' : 'Готов к игре'}
        </Button>
      </div>
    </div>
  );
}
