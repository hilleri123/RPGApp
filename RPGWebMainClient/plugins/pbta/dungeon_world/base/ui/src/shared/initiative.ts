export type SceneInitiative = {
  order: string[];
  values: Record<string, number>;
  active_index: number;
  round: number;
};

export type SceneEntityRef = {
  id: string;
  name: string;
  kind: 'character' | 'npc';
  /** Аватарка (icon_url, иначе img_url); без неё рисуется иконка по типу. */
  iconUrl?: string | null;
  /** Цвет игрока персонажа (заливка квадрата). */
  color?: string | null;
  isEnemy?: boolean;
  isDead?: boolean;
};

type PlayerLike = { character_id?: unknown; characterid?: unknown; color?: string | null };

/** character_id → цвет игрока. */
export function playerColorByCharacter(players: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of Array.isArray(players) ? (players as PlayerLike[]) : []) {
    const cid = String(p?.character_id ?? p?.characterid ?? '').trim();
    if (cid && p?.color) out[cid] = String(p.color);
  }
  return out;
}

export const EMPTY_INITIATIVE: SceneInitiative = {
  order: [],
  values: {},
  active_index: 0,
  round: 1,
};

function isPlainObject(x: unknown): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function uniqStr(xs: unknown): string[] {
  if (!Array.isArray(xs)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const s = String(x ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Приводит блок `initiative` из scene.data к безопасному виду. */
export function readInitiative(data: unknown): SceneInitiative {
  const raw = isPlainObject(data) && isPlainObject(data.initiative) ? data.initiative : {};
  const order = uniqStr(raw.order);

  const values: Record<string, number> = {};
  if (isPlainObject(raw.values)) {
    for (const id of order) {
      const n = Number(raw.values[id]);
      if (Number.isFinite(n)) values[id] = Math.trunc(n);
    }
  }

  let active = Number(raw.active_index);
  if (!Number.isInteger(active) || active < 0 || active >= order.length) active = 0;

  let round = Number(raw.round);
  if (!Number.isInteger(round) || round < 1) round = 1;

  return { order, values, active_index: order.length ? active : 0, round };
}

/** Персонажи и NPC сцены — те, кого можно поставить в очередь. */
export function sceneEntities(scene: any, players?: unknown): SceneEntityRef[] {
  const colors = playerColorByCharacter(players);
  const out: SceneEntityRef[] = [];
  const seen = new Set<string>();

  const push = (raw: any, kind: SceneEntityRef['kind']) => {
    const id = String(raw?.id ?? '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    const tags = (Array.isArray(raw?.tags) ? raw.tags : []).map(String);
    out.push({
      id,
      name: String(raw?.name ?? '').trim() || '—',
      kind,
      iconUrl: raw?.icon_url || raw?.img_url || null,
      color: kind === 'character' ? colors[id] ?? null : null,
      isEnemy: kind === 'npc' && tags.includes('enemy'),
      // Умерший NPC остаётся в очереди, пока мастер сам его не уберёт (вдруг он нежить),
      // но иконка сразу показывает, что он мёртв.
      isDead: tags.includes('dead') || Boolean(raw?.is_dead),
    });
  };

  for (const c of Array.isArray(scene?.characters) ? scene.characters : []) push(c, 'character');
  for (const bucket of [scene?.private, scene?.public]) {
    for (const n of Array.isArray(bucket?.npcs) ? bucket.npcs : []) push(n, 'npc');
  }
  return out;
}

/** Участники контекста действия (scene.characters / scene.npcs): сначала персонажи, потом NPC. */
export function contextEntities(scene: any, players?: unknown): SceneEntityRef[] {
  const colors = playerColorByCharacter(players);
  const out: SceneEntityRef[] = [];
  const push = (raw: any, kind: SceneEntityRef['kind']) => {
    const id = String(raw?.id ?? '').trim();
    if (!id) return;
    const tags = (Array.isArray(raw?.tags) ? raw.tags : []).map(String);
    out.push({
      id,
      name: String(raw?.name ?? '').trim() || '—',
      kind,
      iconUrl: raw?.icon_url || raw?.img_url || null,
      color: kind === 'character' ? colors[id] ?? null : null,
      isEnemy: kind === 'npc' && tags.includes('enemy'),
      isDead: tags.includes('dead') || Boolean(raw?.is_dead),
    });
  };
  for (const c of Array.isArray(scene?.characters) ? scene.characters : []) push(c, 'character');
  for (const n of Array.isArray(scene?.npcs) ? scene.npcs : []) push(n, 'npc');
  return out;
}

/**
 * Порядок показа участников: по очереди инициативы (кого в сцене нет — пропускаем),
 * затем все остальные. Без инициативы получается «сначала персонажи, потом NPC».
 */
export function orderParticipants(
  entities: SceneEntityRef[],
  initiative: SceneInitiative,
): Array<{ entity: SceneEntityRef; position?: number; active: boolean }> {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const out: Array<{ entity: SceneEntityRef; position?: number; active: boolean }> = [];
  const seen = new Set<string>();
  initiative.order.forEach((id, idx) => {
    const entity = byId.get(id);
    if (!entity) return;
    seen.add(id);
    out.push({ entity, position: idx + 1, active: idx === initiative.active_index });
  });
  for (const entity of entities) {
    if (!seen.has(entity.id)) out.push({ entity, active: false });
  }
  return out;
}

export function entityNameMap(scene: any, players?: unknown): Record<string, SceneEntityRef> {
  const map: Record<string, SceneEntityRef> = {};
  for (const e of sceneEntities(scene, players)) map[e.id] = e;
  return map;
}

/** Меняет местами соседей; возвращает тот же массив, если двигать некуда. */
export function moveInOrder(order: string[], index: number, dir: -1 | 1): string[] {
  const j = index + dir;
  if (index < 0 || index >= order.length || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

/** Сдвигает участника на одну позицию; активным остаётся тот же участник. */
export function reorderInitiative(init: SceneInitiative, index: number, dir: -1 | 1): SceneInitiative {
  const order = moveInOrder(init.order, index, dir);
  if (order === init.order) return init;
  const activeId = init.order[init.active_index];
  return { ...init, order, active_index: Math.max(0, order.indexOf(activeId)) };
}

/**
 * Вставляет участника в очередь по итогу броска (по убыванию значений),
 * после тех, у кого значение не меньше.
 */
export function insertByValue(init: SceneInitiative, id: string, value: number): SceneInitiative {
  if (init.order.includes(id)) return init;
  const values = { ...init.values, [id]: value };

  let at = init.order.length;
  for (let i = 0; i < init.order.length; i++) {
    const other = values[init.order[i]];
    if (other !== undefined && other < value) {
      at = i;
      break;
    }
  }

  const order = [...init.order.slice(0, at), id, ...init.order.slice(at)];
  // Активный участник остаётся тем же, даже если новичок встал перед ним.
  const activeId = init.order[init.active_index];
  const active = activeId ? order.indexOf(activeId) : 0;
  return { ...init, order, values, active_index: Math.max(0, active) };
}

export function removeFromInitiative(init: SceneInitiative, id: string): SceneInitiative {
  const idx = init.order.indexOf(id);
  if (idx < 0) return init;

  const order = init.order.filter((x) => x !== id);
  const values = { ...init.values };
  delete values[id];

  let active = init.active_index;
  if (idx < active) active -= 1;
  if (active >= order.length) active = 0;
  return { ...init, order, values, active_index: order.length ? active : 0 };
}
