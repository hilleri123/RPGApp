import type { ActionRuntime } from './actionRuntime';
import type { SceneContext, Links, Player } from './actionContext';

type HasScene = { scene?: { scene?: SceneContext; links?: Links; players?: Player[] } | null };

export function getSceneBundle(action: HasScene | null | undefined) {
  return {
    scene: action?.scene?.scene ?? null,
    links: action?.scene?.links ?? { characterToUserId: {} },
    players: action?.scene?.players ?? [],
  };
}