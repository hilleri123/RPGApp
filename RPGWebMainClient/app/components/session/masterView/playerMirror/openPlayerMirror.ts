/** Open a read-only player UI mirror in a separate browser window (GM). */

export function playerMirrorWindowName(sessionId: string, playerUserId: string): string {
  return `rpg-player-mirror-${sessionId}-${playerUserId}`;
}

export function buildPlayerMirrorUrl(sessionId: string, playerUserId: string): string {
  const url = new URL(`/session/${sessionId}`, window.location.origin);
  url.searchParams.set('viewAsPlayer', playerUserId);
  return url.toString();
}

/** Opens (or focuses) a pop-out window showing the session as a given player. */
export function openPlayerMirror(sessionId: string, playerUserId: string): Window | null {
  if (typeof window === 'undefined') return null;
  const url = buildPlayerMirrorUrl(sessionId, playerUserId);
  const name = playerMirrorWindowName(sessionId, playerUserId);
  return window.open(
    url,
    name,
    'width=1280,height=900,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes',
  );
}
