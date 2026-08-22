'use client';

import React from 'react';
import { TYPE_COLORS } from '@/lib/constants';

export type NpcComposition = {
  normal: number;
  enemy: number;
  dead: number;
  enemyDead: number;
};

export function getNpcComposition(npcs: Array<{ tags?: string[] | null }>): NpcComposition & { total: number } {
  let normal = 0;
  let enemy = 0;
  let dead = 0;
  let enemyDead = 0;

  for (const n of npcs) {
    const tags: string[] = Array.isArray(n.tags) ? n.tags : [];
    const isDead = tags.includes('dead');
    const isEnemy = tags.includes('enemy');
    if (!isDead && !isEnemy) normal++;
    else if (!isDead && isEnemy) enemy++;
    else if (isDead && !isEnemy) dead++;
    else enemyDead++;
  }

  return { normal, enemy, dead, enemyDead, total: npcs.length };
}

function compositionTotal(comp: NpcComposition) {
  return comp.normal + comp.enemy + comp.dead + comp.enemyDead;
}

export function NpcCompositionBadge({
  npcs,
  composition,
  label = 'NPC',
  className = '',
}: {
  npcs?: Array<{ tags?: string[] | null }>;
  composition?: NpcComposition;
  label?: string;
  className?: string;
}) {
  const comp = composition ?? (npcs ? getNpcComposition(npcs) : { normal: 0, enemy: 0, dead: 0, enemyDead: 0 });
  const total = compositionTotal(comp);
  if (total <= 0) return null;

  const segments = [
    { count: comp.normal, color: `${TYPE_COLORS.npc}CC` },
    { count: comp.enemy, color: `${TYPE_COLORS.enemy_npc}CC` },
    { count: comp.dead, color: `${TYPE_COLORS.dead_npc}CC` },
    { count: comp.enemyDead, color: `${TYPE_COLORS.enemy_dead_npc}CC` },
  ].filter((s) => s.count > 0);

  let pos = 0;
  const stops: string[] = [];
  for (const s of segments) {
    const pct = (s.count / total) * 100;
    const start = pos;
    pos += pct;
    stops.push(`${s.color} ${start.toFixed(1)}%`, `${s.color} ${pos.toFixed(1)}%`);
  }

  return (
    <span
      className={`relative inline-flex items-center text-[10px] rounded-md border px-2 py-0.5 ${className}`}
      style={{ borderColor: 'rgba(15,23,42,0.9)', overflow: 'hidden' }}
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ background: `linear-gradient(to right, ${stops.join(', ')})` }}
      />
      <span aria-hidden className="absolute inset-0" style={{ background: 'rgba(2,6,23,0.85)' }} />
      <span className="relative flex items-center gap-1">
        <span className="font-semibold" style={{ color: TYPE_COLORS.npc }}>
          {label}: {total}
        </span>
      </span>
    </span>
  );
}
