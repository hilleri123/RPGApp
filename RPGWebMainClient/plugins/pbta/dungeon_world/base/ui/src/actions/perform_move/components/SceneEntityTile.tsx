'use client';

import React from 'react';
import { Mountain, Skull, User } from 'lucide-react';

export type SceneEntityKind = 'character' | 'npc' | 'world';

export type SceneEntityRef = {
  kind: SceneEntityKind;
  id: string;
  name: string;
  img_url?: string | null;
  icon_url?: string | null;
};

function FallbackIcon({ kind }: { kind: SceneEntityKind }) {
  if (kind === 'npc') return <Skull className="w-5 h-5 text-white/50" />;
  if (kind === 'world') return <Mountain className="w-5 h-5 text-amber-300/70" />;
  return <User className="w-5 h-5 text-white/50" />;
}

export function SceneEntityTile({
  entity,
  active,
  disabled,
  badge,
  onClick,
}: {
  entity: SceneEntityRef;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  const src = entity.img_url || entity.icon_url || null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded border px-2 py-2 text-left transition-colors disabled:opacity-50 ${
        active
          ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100'
          : 'border-white/10 bg-zinc-950/30 text-white/80 hover:bg-white/5'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={String(src)} alt="" className="w-full h-full object-cover" />
          ) : (
            <FallbackIcon kind={entity.kind} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{entity.name}</div>
          <div className="text-[10px] text-white/40">
            {entity.kind === 'character' ? 'персонаж' : entity.kind === 'npc' ? 'NPC' : 'окружение'}
            {badge ? ` · ${badge}` : ''}
          </div>
        </div>
      </div>
    </button>
  );
}

export function buildSceneEntities(scene: any): SceneEntityRef[] {
  const characters = (Array.isArray(scene?.characters) ? scene.characters : []).map((x: any) => ({
    kind: 'character' as const,
    id: String(x.id),
    name: String(x.name ?? 'Безымянный персонаж'),
    img_url: x.img_url ?? null,
    icon_url: x.icon_url ?? null,
  }));
  const npcs = (Array.isArray(scene?.npcs) ? scene.npcs : []).map((x: any) => ({
    kind: 'npc' as const,
    id: String(x.id),
    name: String(x.name ?? 'Безымянный NPC'),
    img_url: x.img_url ?? null,
    icon_url: x.icon_url ?? null,
  }));
  return [...characters, ...npcs];
}
