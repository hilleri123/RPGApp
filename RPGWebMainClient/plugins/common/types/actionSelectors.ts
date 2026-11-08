import type { ActionRuntime } from './actionRuntime';
import type { SceneContext, Links, Player } from './actionContext';

type HasScene = { scene?: { scene?: SceneContext; links?: Links; players?: Player[] } | null };

function looksLikeScene(value: unknown): value is SceneContext {
  if (!value || typeof value !== 'object') return false;
  const scene = value as Record<string, unknown>;
  return 'characters' in scene || 'character_ids' in scene || 'npcs' in scene || 'public' in scene;
}

export function getSceneBundle(action: HasScene | null | undefined) {
  const raw = action?.scene;
  const nested = raw?.scene;
  const scene = looksLikeScene(nested) ? nested : looksLikeScene(raw) ? (raw as unknown as SceneContext) : null;
  return {
    scene,
    links: raw?.links ?? { characterToUserId: {} },
    players: raw?.players ?? [],
  };
}