'use client';

import React from 'react';
import { ChevronRight, MapPin, Package, User, Users } from 'lucide-react';
import { TYPE_COLORS } from '@/lib/constants';
import { getNpcStyle } from '@/lib/constants';
import { cn } from '@/lib/utils';

type SeenEntityListItemProps = {
  kind: 'npc' | 'game_item' | 'player_character' | 'location';
  name: string;
  subtitle?: string | null;
  iconUrl?: string | null;
  imgUrl?: string | null;
  npcTags?: string[];
  onClick: () => void;
};

const KIND_ICONS = {
  npc: Users,
  game_item: Package,
  player_character: User,
  location: MapPin,
} as const;

function stripHtml(value?: string | null): string {
  if (!value) return '';
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function SeenEntityListItem({
  kind,
  name,
  subtitle,
  iconUrl,
  imgUrl,
  npcTags,
  onClick,
}: SeenEntityListItemProps) {
  const color = TYPE_COLORS[kind === 'game_item' ? 'item' : kind === 'player_character' ? 'character' : kind];
  const FallbackIcon = KIND_ICONS[kind];

  let npcIcon: React.ReactNode = <FallbackIcon className="w-7 h-7 text-white/85" />;
  if (kind === 'npc' && npcTags) {
    const { icon: NpcIcon } = getNpcStyle(npcTags.includes('dead'), npcTags.includes('enemy'));
    npcIcon = <NpcIcon className="w-7 h-7 text-white/85" />;
  }

  const mediaUrl = imgUrl || iconUrl;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border border-gray-700/80 bg-gray-900/70',
        'hover:bg-gray-800/80 active:bg-gray-800 transition-colors',
        'flex items-stretch gap-3 p-3 min-h-[76px]',
      )}
    >
      <div
        className="shrink-0 w-[72px] rounded-lg border border-white/10 bg-black/25 flex items-center justify-center overflow-hidden self-stretch"
        style={{ boxShadow: `inset 0 0 0 1px ${color}33` }}
      >
        {mediaUrl ? (
          <img
            src={mediaUrl}
            alt=""
            className="max-w-full max-h-[68px] object-contain p-1"
          />
        ) : (
          npcIcon
        )}
      </div>

      <div className="min-w-0 flex-1 flex flex-col justify-center py-0.5">
        <div className="font-medium text-sm text-white truncate">{name}</div>
        {subtitle ? (
          <div className="text-xs text-gray-400 mt-1 line-clamp-2 leading-snug">
            {stripHtml(subtitle)}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 self-center text-gray-500">
        <ChevronRight className="w-4 h-4" />
      </div>
    </button>
  );
}
