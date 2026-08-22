'use client';

import type { NpcData } from '../types';

type Props = {
  data: Record<string, any>;
  config?: any;
};

export default function NPCDataView({ data }: Props) {
  const npc = (data ?? {}) as NpcData;
  const tags = (npc.tags ?? []).filter(Boolean);

  const hp = Number((npc.tracks as any)?.hp ?? 0) || 0;
  const eq = Number((npc.tracks as any)?.eq ?? 0) || 0;
  const hpMax = Number((npc.trackMax as any)?.hp ?? 0) || 0;
  const eqMax = Number((npc.trackMax as any)?.eq ?? 0) || 0;

  return (
    <div className="space-y-2">
      <div className="text-sm text-white/90">NPC: <span className="text-white/70">{npc.name ?? '—'}</span></div>
      <div className="text-sm text-white/80">HP: {hp} / {hpMax} • EQ: {eq} / {eqMax}</div>
      {tags.length ? <div className="text-sm text-white/70">Tags: {tags.join(', ')}</div> : null}
      {Array.isArray(npc.items) && npc.items.length ? <div className="text-sm text-white/70">Items: {npc.items.join(', ')}</div> : null}
    </div>
  );
}
