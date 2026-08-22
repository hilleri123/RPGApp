'use client';

import type { CharacterConfig, CharacterData } from '../types';

type Props = {
  data: Record<string, any>;
  config?: CharacterConfig;
};

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

export default function CharacterDataView({ data, config }: Props) {
  const ch: CharacterData = {
    profession: String((data as any)?.profession ?? '').trim(),
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-white/10 bg-white/5 p-3">
        <div className="text-xs text-white/60">Профессия</div>
        <div className="text-sm text-white/90">{ch.profession || '—'}</div>
      </div>

      {!config ? (
        <pre className="text-xs text-white/50 whitespace-pre-wrap">
          {JSON.stringify(isPlainObject(data) ? data : {}, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
