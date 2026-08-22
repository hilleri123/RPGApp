'use client';

import { AUDIO_TRACK_TAGS } from './audioTags';

export function AudioTagFilter({
  value,
  onChange,
  size = 'sm',
}: {
  value: string[];
  onChange: (next: string[]) => void;
  size?: 'sm' | 'xs';
}) {
  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  return (
    <div className="flex flex-wrap gap-1.5">
      {AUDIO_TRACK_TAGS.map((tag) => {
        const active = value.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={[
              'rounded-full border transition-colors',
              pad,
              active
                ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80',
            ].join(' ')}
          >
            {tag.label}
          </button>
        );
      })}
      {value.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className={`rounded-full border border-white/10 text-white/40 hover:text-white/70 ${pad}`}
        >
          Сброс
        </button>
      ) : null}
    </div>
  );
}
