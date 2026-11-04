'use client';

const SRC = {
  hand: '/emoji/raise-hand.webp',
  up: '/emoji/thumbs-up.webp',
  down: '/emoji/thumbs-down.webp',
} as const;

export type SceneCueKind = keyof typeof SRC;

export function sceneCueKind(kind: string | undefined): SceneCueKind {
  return kind === 'up' || kind === 'down' ? kind : 'hand';
}

function playerColor(color: string | null | undefined): string | undefined {
  if (!color || !/^#[0-9a-fA-F]{3,8}$/.test(color)) return undefined;
  return color;
}

export function SceneCueToast({
  name,
  kind,
  iconUrl,
  color,
}: {
  name: string;
  kind: SceneCueKind;
  iconUrl?: string | null;
  color?: string | null;
}) {
  const ring = playerColor(color);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const tail = kind === 'up' ? ': палец вверх' : kind === 'down' ? ': палец вниз' : ' хочет говорить';
  return (
    <span className="flex items-center gap-2">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/25 bg-gray-600 text-sm font-semibold text-white"
        style={ring ? { borderColor: ring, boxShadow: `0 0 0 1px ${ring}` } : undefined}
      >
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{initial}</span>
        )}
      </span>
      <SceneCueEmoji kind={kind} className="h-9 w-9 shrink-0" />
      <span>
        <span
          className="font-medium"
          style={ring ? { color: ring, textShadow: '0 0 2px rgba(0,0,0,0.85)' } : undefined}
        >
          {name}
        </span>
        {tail}
      </span>
    </span>
  );
}

export function SceneCueEmoji({ kind, className }: { kind: SceneCueKind; className?: string }) {
  return (
    <img
      src={SRC[kind]}
      alt=""
      draggable={false}
      className={className ?? 'h-10 w-10'}
    />
  );
}
