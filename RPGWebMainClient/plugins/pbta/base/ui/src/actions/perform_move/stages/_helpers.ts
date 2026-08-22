export function asStr(x: any, fb = ''): string {
  return String(x ?? '').trim() || fb;
}

export function asBool(x: any, fb = false): boolean {
  return typeof x === 'boolean' ? x : fb;
}

export function asNum(x: any, fb = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fb;
}

export function charByUser(scene: any, links: any, userId: string) {
  return (scene?.characters ?? []).find(
    (ch: any) => String(links?.characterToUserId?.[ch.id] ?? '') === String(userId)
  );
}

export function getActorName(scene: any, entry: any): string {
  if (entry?.actorCharacterId) {
    return scene?.characters?.find((x: any) => String(x.id) === String(entry.actorCharacterId))?.name ?? 'Персонаж';
  }
  if (entry?.actorNpcId) {
    return scene?.npcs?.find((x: any) => String(x.id) === String(entry.actorNpcId))?.name ?? 'NPC';
  }
  return '—';
}

export function getTargetName(scene: any, entry: any): string {
  if (entry?.targetCharacterId) {
    return scene?.characters?.find((x: any) => String(x.id) === String(entry.targetCharacterId))?.name ?? 'Персонаж';
  }
  if (entry?.targetNpcId) {
    return scene?.npcs?.find((x: any) => String(x.id) === String(entry.targetNpcId))?.name ?? 'NPC';
  }
  return '—';
}

export function pbtaModifier(value: number): number {
  if (value <= 3) return -3;
  if (value <= 5) return -2;
  if (value <= 8) return -1;
  if (value <= 12) return 0;
  if (value <= 15) return 1;
  if (value <= 17) return 2;
  return 3;
}


export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === 'string');
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function asNumberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
    }
  }
  return out;
}