import { User } from '@/app/services/types/auth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Star } from 'lucide-react';
import { UserCard } from '../common/UserCard';
import { useLobbyWebSocket } from '@/app/services/hooks/useLobbyWebSocket';



interface MasterCardProps {
  lobbyId: string;
}


export const MasterCard: React.FC<MasterCardProps> = ({ lobbyId }) => {

  const {
    lobby
  } = useLobbyWebSocket(lobbyId);
  const gameMaster = lobby.master;
  // const joinedAt = new Date(gameMaster.joined_at);
  // const minutesConnected = Math.floor((Date.now() - joinedAt.getTime()) / 60000);

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-500" />
          <CardTitle className="text-lg">Мастер игры</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <UserCard user={gameMaster}/>
          {/* <div>
            <h3 className="font-bold text-white">{gameMaster.full_name}</h3>
            <p className="text-sm text-gray-400">{gameMaster.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                Ур. {gameMaster.level}
              </Badge>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500" />
                <span className="text-xs text-gray-400">{gameMaster.rating}</span>
              </div>
            </div>
          </div> */}
        </div>
        {/* <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Опыт:</span>
            <span>{gameMaster.experience}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Сессий проведено:</span>
            <span>{gameMaster.sessionsHosted}</span>
          </div>
        </div> */}
      </CardContent>
    </Card>
  );
};
