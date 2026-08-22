import { LogMoveItem, LogMsg } from "@/app/services/types/logmsg";
import { GameSession, GameSessionBase } from "@/app/services/types/session";
import { GameItem, NPC, PlayerCharacter, Location } from "@/app/services/types2";



export interface DataLogMsgProps {
  session: GameSessionBase;
  characters: PlayerCharacter[];
  npcs: NPC[];
  items: GameItem[];
  locations: Location[];
}
