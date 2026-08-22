import { useMemo } from 'react';
import { Player } from '@/app/services/types/lobby';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserCard } from '../common/UserCard';
import { useLobbyWebSocket } from '@/app/services/hooks/useLobbyWebSocket';
import { playerHasCharacterAssignment } from './lobbyCharacterOccupancy';

interface PlayerCardProps {
  lobbyId: string;
  player: Player;
  compact?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  lobbyId,
  player,
  compact = false,
}) => {
  const {
    lobby,
    isMaster,
    masterKickPlayer,
    masterPlayerDeselectCharacter,
  } = useLobbyWebSocket(lobbyId);

  const joinedAt = new Date(player.joined_at);

  const selectedCharacter = useMemo(() => {
    if (player.character) return player.character;
    const allCharacters = [
      ...(lobby?.characters || []),
      ...(((lobby as any)?.imported_characters || [])),
    ];
    return allCharacters.find((ch: any) => String(ch.id) === String(player.character_id)) || null;
  }, [lobby?.characters, (lobby as any)?.imported_characters, player.character_id, player.character]);

  const isImportedCharacter = useMemo(() => {
    if (player.application_id) return true;
    return (((lobby as any)?.imported_characters || []) as any[]).some(
      (ch) => String(ch.id) === String(player.character_id)
    );
  }, [(lobby as any)?.imported_characters, player.character_id, player.application_id]);

  return (
    <Card className={`bg-gray-700 border-gray-600 transition-all duration-300 ${compact ? '' : 'hover:bg-gray-650 cursor-pointer'}`}>
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-center gap-3 mb-3">
          <UserCard user={player.user} color={player.color} />
          <div className="flex-1">
            {isMaster && (
              <div className="flex gap-2 mt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    masterKickPlayer(player.id);
                  }}
                >
                  Кикнуть
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!playerHasCharacterAssignment(player)}
                  onClick={(e) => {
                    e.stopPropagation();
                    masterPlayerDeselectCharacter(player.id, player.user.id);
                  }}
                >
                  Сбросить персонажа
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-white">{player.name}</h4>
              {player.is_ready && (
                <Badge variant="default" className="text-xs bg-green-600">
                  Готов
                </Badge>
              )}
            </div>

            <p className="text-xs text-gray-400">
              Подключился {Math.floor((Date.now() - joinedAt.getTime()) / 60000)} мин назад
            </p>
          </div>
        </div>

        {selectedCharacter && (
          <div className="rounded-lg border border-white/10 bg-black/20 p-3 mb-3">
            <div className="flex items-start gap-3">
              {selectedCharacter.icon_url ? (
                <img
                  src={selectedCharacter.icon_url}
                  alt=""
                  className="w-12 h-12 rounded-md object-cover border border-white/10"
                />
              ) : (
                <div className="w-12 h-12 rounded-md bg-white/10 border border-white/10 flex items-center justify-center text-white/70 text-sm font-semibold">
                  {selectedCharacter.name?.slice(0, 1)?.toUpperCase() ?? 'C'}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-400 mb-1">Выбран персонаж</div>
                <div className="text-white font-medium truncate">{selectedCharacter.name}</div>

                {selectedCharacter.short_desc && (
                  <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {selectedCharacter.short_desc}
                  </div>
                )}

                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">
                    {isImportedCharacter ? 'Импортирован из заявки' : 'Персонаж сценария'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {!selectedCharacter && playerHasCharacterAssignment(player) && (
          <div className="text-xs text-amber-400 mb-3">
            Персонаж выбран, но ещё не найден в списке лобби.
          </div>
        )}
      </CardContent>
    </Card>
  );
};