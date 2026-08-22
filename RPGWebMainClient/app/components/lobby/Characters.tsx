import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { Users } from "lucide-react";
import { useMemo } from 'react';
import { useLobbyWebSocket } from '@/app/services/hooks/useLobbyWebSocket';
import { CharacterCard } from './CharacterCard';
import { playerHasCharacterAssignment } from './lobbyCharacterOccupancy';

interface CharactersProps {
  lobbyId: string;
  /** Встроенный режим для мобильного лобби — без Card, растягивается по высоте */
  variant?: 'card' | 'embedded';
}

export const Characters: React.FC<CharactersProps> = ({ lobbyId, variant = 'card' }) => {
  const { lobby } = useLobbyWebSocket(lobbyId);

  const players = lobby?.players || [];

  const characters = useMemo(() => {
    const base = lobby?.characters || [];
    const imported = (lobby as any)?.imported_characters || [];

    const seen = new Set<string>();
    const merged = [];

    for (const ch of [...base, ...imported]) {
      const id = String(ch.id);
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(ch);
    }

    return merged;
  }, [lobby?.characters, (lobby as any)?.imported_characters]);

  const list = (
    <div className={variant === 'embedded' ? 'space-y-2' : 'space-y-3'}>
      {characters.map((character) => (
        <motion.div key={character.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <CharacterCard lobbyId={lobbyId} character={character} compact={variant === 'embedded'} />
        </motion.div>
      ))}
      {characters.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">Персонажи сценария пока не загружены</p>
      ) : null}
    </div>
  );

  if (variant === 'embedded') {
    return (
      <div className="flex flex-col min-h-0 flex-1 h-full">
        <div className="shrink-0 flex items-center justify-between gap-2 pb-2">
          <h2 className="text-sm font-medium text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            Персонажи
          </h2>
          <Badge variant="secondary" className="text-xs">
            {characters.length - players.filter((p) => playerHasCharacterAssignment(p)).length}/{characters.length} свободны
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
            Персонажи
          </CardTitle>
          <Badge variant="secondary">
            {characters.length - players.filter((p) => playerHasCharacterAssignment(p)).length}/{characters.length} свободны
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {characters.map((character) => (
              <motion.div key={character.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <CharacterCard lobbyId={lobbyId} character={character} />
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};