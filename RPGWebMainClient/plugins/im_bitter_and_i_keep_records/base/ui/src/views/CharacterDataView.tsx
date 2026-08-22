'use client';

import type { CharacterConfig, CharacterData, Trait, PassiveState } from '../types';

type Props = {
  data: Record<string, any>;
  config?: CharacterConfig;
};

const pill =
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-white/10 bg-white/5 text-white/90';

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

export default function CharacterDataView({ data, config }: Props) {
  const ch = (data ?? {}) as CharacterData;

  const tags = (Array.isArray(ch.tags) ? ch.tags : []).filter(Boolean);
  const traits = (Array.isArray(ch.traits) ? ch.traits : []) as Trait[];
  const passives = (Array.isArray(ch.passives) ? ch.passives : []) as PassiveState[];

  const tracks = isPlainObject(ch.tracks) ? ch.tracks : {};
  const trackMax = isPlainObject(ch.trackMax) ? ch.trackMax : {};

  const t = (k: string) => Number((tracks as any)[k] ?? 0) || 0;
  const mx = (k: string) => Number((trackMax as any)[k] ?? 0) || 0;

  const economy = isPlainObject(ch.economy) ? ch.economy : {};

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {(['hp', 'eq', 'fat', 'conc', 'grudge'] as const).map((k) => (
          <div key={k} className="rounded-md border border-white/10 bg-white/5 p-2">
            <div className="text-xs text-white/60">{k.toUpperCase()}</div>
            <div className="text-sm">
              {t(k)} / <span className="text-white/60">{mx(k)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-sm text-white/80">
        Действия: main={Number((economy as any).main ?? 1) || 0}, move={Number((economy as any).move ?? 1) || 0},
        defense={Number((economy as any).defense ?? 1) || 0}
      </div>

      {tags.length ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((x) => (
            <span key={x} className={pill}>
              {x}
            </span>
          ))}
        </div>
      ) : null}

      {traits.length ? (
        <div className="space-y-1">
          <div className="text-sm text-white/80">Traits</div>
          {traits.map((tr, i) => (
            <div key={(tr as any).id ?? i} className="text-sm text-white/70">
              • {(tr as any).text}
            </div>
          ))}
        </div>
      ) : null}

      {passives.length ? (
        <div className="space-y-1">
          <div className="text-sm text-white/80">Пассивки</div>
          {passives.map((p, i) => (
            <div key={`${(p as any).id ?? 'passive'}_${i}`} className="text-sm text-white/70">
              • {(p as any).id}
              {(p as any).enabled === false ? ' (off)' : ''}
            </div>
          ))}
        </div>
      ) : null}

      {Array.isArray(ch.items) && ch.items.length ? (
        <div className="text-sm text-white/80">
          Items: <span className="text-white/70">{ch.items.join(', ')}</span>
        </div>
      ) : null}

      {!config ? (
        <pre className="text-xs text-white/50 whitespace-pre-wrap">{JSON.stringify(data ?? {}, null, 2)}</pre>
      ) : null}
    </div>
  );
}
