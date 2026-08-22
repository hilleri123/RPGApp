'use client';

import React from 'react';
import type { FrontBadgeInfo } from '@/app/services/types2';

/** Colored corner ribbon + front icon; click opens the Front. Master-only. */
export function FrontRibbon({
  fronts,
  onOpenFront,
}: {
  fronts: FrontBadgeInfo[];
  onOpenFront?: (frontId: string) => void;
}) {
  if (!fronts?.length) return null;

  return (
    <div className="absolute left-0 top-0 bottom-0 flex flex-col z-10 pointer-events-none">
      {fronts.map((f) => (
        <button
          key={f.id}
          type="button"
          title={f.name}
          className="pointer-events-auto flex-1 min-h-[1.25rem] w-5 flex items-center justify-center border-r border-black/20 hover:brightness-110 transition"
          style={{ backgroundColor: f.color || '#7c3aed' }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenFront?.(f.id);
          }}
        >
          {f.icon_url ? (
            <img src={f.icon_url} alt="" className="w-3.5 h-3.5 object-contain drop-shadow" />
          ) : (
            <span className="text-[9px] font-bold text-white/90 leading-none">F</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function frontsForEntityTags(
  entityTags: string[] | null | undefined,
  fronts: FrontBadgeInfo[],
): FrontBadgeInfo[] {
  const tags = new Set((entityTags ?? []).map(String));
  return fronts.filter((f) => f.tag_key && tags.has(f.tag_key));
}
