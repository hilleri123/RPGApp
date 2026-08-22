import type { Player } from '@/app/services/types/lobby';

/** Кто занял персонажа в лобби (сценарий или импорт из заявки). */
export function findPlayerWithCharacter(
  players: Player[] | undefined,
  character: { id: string | number; application_id?: string | null },
): Player | null {
  if (!players?.length) return null;
  const charId = String(character.id);
  const appId = character.application_id ? String(character.application_id) : null;

  for (const p of players) {
    const cid = p.character_id ? String(p.character_id) : '';
    const paid = p.application_id ? String(p.application_id) : '';
    if (cid && cid === charId) return p;
    if (appId && cid === appId) return p;
    if (appId && paid === appId) return p;
  }
  return null;
}

export function playerHasCharacterAssignment(player: Player | null | undefined): boolean {
  if (!player) return false;
  return Boolean(player.character_id || player.application_id);
}
