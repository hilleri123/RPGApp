'use client';

import React from 'react';
import type { SceneData } from '../types';

type Props = {
  scene: Record<string, any>;
  data: SceneData | Record<string, any> | null | undefined;
};

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function asStr(x: any) {
  const s = String(x ?? '').trim();
  return s;
}

function asInt(x: any, fb = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : fb;
}

export default function SceneDataView({ data, scene }: Props) {
  const src: any = data && (isPlainObject(data) ? data : {});
  const characterId = src?.character_id == null ? null : asStr(src.character_id) || null;
  const buff = asInt(src?.buff, 0);

  const character_name = characterId
    ? (scene.characters.find((c: any) => c.id === characterId)?.name ?? '—')
    : '—';

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-md border border-white/10 bg-white/5 p-3">
        <div className="text-xs text-white/60">Активный персонаж</div>
        <div className="text-sm text-white/90">{character_name}</div>
      </div>

      <div className="rounded-md border border-white/10 bg-white/5 p-3">
        <div className="text-xs text-white/60">buff</div>
        <div className="text-sm text-white/90">{buff}</div>
      </div>
    </div>
  );
}
