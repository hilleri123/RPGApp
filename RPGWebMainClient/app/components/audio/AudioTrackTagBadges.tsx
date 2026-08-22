'use client';

import { getAudioTagLabel } from './audioTags';

export function AudioTrackTagBadges({ tags }: { tags?: string[] | null }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0 text-[10px] text-white/50"
        >
          {getAudioTagLabel(tag)}
        </span>
      ))}
    </div>
  );
}
