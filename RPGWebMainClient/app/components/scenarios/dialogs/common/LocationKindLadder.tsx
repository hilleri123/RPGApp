'use client';

import { useMemo } from 'react';
import {
  LOCATION_KINDS,
  allowedChildKinds,
  kindById,
  kindOfTags,
} from '@/app/lib/locationKinds';

const INDENT_PX = 16;

type LocLike = { id: string | number; name: string; parent_location_id?: string | null; tags?: string[] | null };

/**
 * Цепочка предков локации: «🌍 Мир › 🧭 Север › 🏙️ Город › ● эта локация».
 * Родитель берётся из выбранного в форме поля, остальные — по parent_location_id.
 */
export function LocationAncestry({
  locations,
  parentId,
  currentName,
  currentKindId,
}: {
  locations: LocLike[];
  parentId: string | null | undefined;
  currentName: string;
  currentKindId: string | null;
}) {
  const chain = useMemo(() => {
    const byId = new Map(locations.map((l) => [String(l.id), l]));
    const out: LocLike[] = [];
    const seen = new Set<string>();
    let cur = parentId ? byId.get(String(parentId)) : undefined;
    while (cur && !seen.has(String(cur.id))) {
      seen.add(String(cur.id));
      out.unshift(cur);
      cur = cur.parent_location_id ? byId.get(String(cur.parent_location_id)) : undefined;
    }
    return out;
  }, [locations, parentId]);

  const current = kindById(currentKindId);
  if (chain.length === 0 && !current) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-gray-300">
      {chain.map((l) => {
        const k = kindOfTags(l.tags);
        return (
          <span key={String(l.id)} className="inline-flex items-center gap-1">
            <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5" title={k?.label}>
              {k ? `${k.emoji} ` : ''}
              {l.name}
            </span>
            <span className="text-gray-600">›</span>
          </span>
        );
      })}
      <span className="rounded-md border border-indigo-400/50 bg-indigo-500/15 px-1.5 py-0.5 text-indigo-100">
        {current ? `${current.emoji} ` : ''}
        {currentName.trim() || 'Эта локация'}
      </span>
    </div>
  );
}

/**
 * Лесенка видов: отступ = уровень иерархии, подсвечен текущий вид,
 * недопустимые внутри вида родителя затемнены и недоступны.
 */
export function LocationKindLadder({
  value,
  onChange,
  parentKindId,
  readOnly = false,
}: {
  value: string | null;
  onChange: (kindId: string | null) => void;
  parentKindId: string | null;
  readOnly?: boolean;
}) {
  const allowedIds = useMemo(() => new Set(allowedChildKinds(parentKindId).map((k) => k.id)), [parentKindId]);
  const parent = kindById(parentKindId);
  const currentKind = kindById(value);
  // «Можно внутри» — тот же вид и все потомки. Без выбранного вида подписи нет,
  // иначе allowedChildKinds(null) подписал бы все строки.
  const insideCurrent = useMemo(
    () => new Set(currentKind ? allowedChildKinds(currentKind.id).map((k) => k.id) : []),
    [currentKind],
  );

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2">
      <div className="flex flex-col gap-0.5">
        {LOCATION_KINDS.map((k) => {
          const active = currentKind?.id === k.id;
          const allowed = allowedIds.has(k.id);
          const disabled = readOnly || (!allowed && !active);
          const isChildOfCurrent = insideCurrent.has(k.id);
          return (
            <div key={k.id} style={{ marginLeft: k.level * INDENT_PX }} className="flex items-center gap-1">
              <span className="text-gray-600 text-xs select-none">{k.level > 0 ? '└' : ''}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(active ? null : k.id)}
                title={
                  !allowed && !active && parent
                    ? `Нельзя внутри «${parent.label}»`
                    : active
                      ? 'Нажмите, чтобы снять вид'
                      : k.label
                }
                className={[
                  'rounded-full border px-2 py-0.5 text-xs transition-colors',
                  active
                    ? 'border-indigo-400/70 bg-indigo-500/25 text-indigo-50'
                    : allowed
                      ? 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                      : 'border-white/5 bg-transparent text-white/25 cursor-not-allowed',
                  readOnly && !active ? 'opacity-60' : '',
                ].join(' ')}
              >
                {k.emoji} {k.label}
              </button>
              {isChildOfCurrent ? (
                <span className="text-[10px] text-indigo-300/80">можно внутри</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[10px] text-gray-500">
        {parent
          ? `Родитель — «${parent.emoji} ${parent.label}»: серые виды внутри него недоступны.`
          : 'У родителя нет вида (или родителя нет) — доступны все виды.'}
      </div>
    </div>
  );
}
