/** Open a master scene view in a separate browser window. */

export function scenePopoutWindowName(sessionId: string, sceneId: string): string {
  return `rpg-scene-${sessionId}-${sceneId}`;
}

export function buildScenePopoutUrl(sessionId: string, sceneId: string): string {
  const url = new URL(`/session/${sessionId}`, window.location.origin);
  url.searchParams.set('popout', '1');
  url.searchParams.set('scene', sceneId);
  return url.toString();
}

/** Opens (or focuses) a pop-out window locked to the given scene. */
export function openScenePopout(sessionId: string, sceneId: string): Window | null {
  if (typeof window === 'undefined') return null;
  const url = buildScenePopoutUrl(sessionId, sceneId);
  const name = scenePopoutWindowName(sessionId, sceneId);
  // Named window reuses an existing popout for the same scene (same monitor workflow).
  return window.open(
    url,
    name,
    'width=1280,height=900,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes',
  );
}
