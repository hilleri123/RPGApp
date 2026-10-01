import { Player } from '@/app/services/types/lobby';
import { PlayerCard } from './PlayerCard';
import { Users } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { useLobbyWebSocket } from '@/app/services/hooks/useLobbyWebSocket';





interface PlayersCardProps {
  lobbyId: string;
  variant?: 'card' | 'embedded';
}

export const Players: React.FC<PlayersCardProps> = ({ 
  lobbyId,
  variant = 'card',
}) => {
  const {
    lobby,
    isUserOnline,
  } = useLobbyWebSocket(lobbyId);

  const players = lobby?.players || [];
  const onlineCount = players.filter((p) => isUserOnline(p.user?.id)).length;

  const list = (
    <div className={variant === 'embedded' ? 'space-y-2' : 'space-y-3'}>
      {players?.map((player) => (
        <motion.div key={player.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <PlayerCard lobbyId={lobbyId} player={player} compact={variant === 'embedded'} />
        </motion.div>
      ))}
      {players.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">Пока никого нет</p>
      ) : null}
    </div>
  );

  if (variant === 'embedded') {
    return (
      <div className="flex flex-col min-h-0 flex-1 h-full">
        <div className="shrink-0 flex items-center justify-between gap-2 pb-2">
          <h2 className="text-sm font-medium text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            Игроки
          </h2>
          <Badge variant="secondary" className="text-xs">
            {onlineCount}/{players.length} онлайн
          </Badge>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
          {list}
        </div>
      </div>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Подключенные игроки
        </CardTitle>
        <Badge variant="secondary">
          {onlineCount}/{players.length} онлайн
        </Badge>
      </div>
    </CardHeader>
    <CardContent>
      <ScrollArea className="h-96">
        <div className="space-y-3">
          {players?.map((player) => (
            <motion.div key={player.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <PlayerCard
                lobbyId={lobbyId}
                player={player}
              />
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </CardContent>
  </Card>
  );
};
