// components/session/feeds/notification/userName.ts
import { GameSessionBase } from "@/app/services/types/session";

export function getUserNameById(session: GameSessionBase | undefined, userId: string): string {
  if (!session) return userId;
  if (session.master.id === userId) {
    return session.master.full_name || session.master.email || userId;
  }
  const player = session.players.find(p => p.user.id === userId);
  if (player) {
    return player.user.full_name || player.user.email || userId;
  }
  return userId;
}
