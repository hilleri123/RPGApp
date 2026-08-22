'use client';

import React from 'react';
import type { SceneData } from '../types';

type Props = {
  data: SceneData | Record<string, any> | null | undefined;
};

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function asStr(x: any, fb = '') {
  const s = String(x ?? '').trim();
  return s || fb;
}

export default function SceneDataView({ data }: Props) {
  // Принимаем, что сюда обычно прилетает SceneData.
  // Если всё же прилетел “левый” объект — пытаемся читать поля аккуратно.
  const scene: any = (data && (isPlainObject(data) ? data : {})) as any;

  const mode = asStr(scene?.mode, 'travel');

  const combat = scene?.combat;
  const phase = asStr(combat?.phase, 'move'); // у тебя CombatPhase: move/melee/ranged/other

  const initiativeOrder: any[] = Array.isArray(combat?.initiativeOrder) ? combat.initiativeOrder : [];
  const activeIndex: number = Number.isFinite(Number(combat?.activeIndex)) ? Number(combat.activeIndex) : 0;

  const contacts: any[] = Array.isArray(combat?.contacts) ? combat.contacts : [];

  return (
    <div className="space-y-2">
      <div className="text-white/90">
        <div className="text-sm">
          Режим: <span className="text-white/70">{mode}</span>
        </div>
      </div>

      {mode === 'travel' ? (
        <div className="text-sm text-white/80">
          Темп: <span className="text-white/70">{asStr(scene?.travel?.pace, 'normal')}</span>
        </div>
      ) : null}

      {mode === 'rest' ? (
        <div className="text-sm text-white/80">
          Лагерь: <span className="text-white/70">{scene?.rest?.camp ? 'да' : 'нет'}</span>
        </div>
      ) : null}

      {mode === 'combat' ? (
        <div className="space-y-2">
          <div className="text-sm text-white/80">
            Фаза: <span className="text-white/70">{phase}</span>
          </div>

          <div className="text-sm text-white/80">
            Инициатива:
            {initiativeOrder.length ? (
              <ul className="list-disc pl-5">
                {initiativeOrder.map((id: any, idx: number) => (
                  <li key={`${String(id)}:${idx}`}>
                    {String(id)}
                    {idx === activeIndex ? ' (active)' : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-white/60">—</div>
            )}
          </div>

          <div className="text-sm text-white/80">
            Контакты:
            {contacts.length ? (
              <ul className="list-disc pl-5">
                {contacts.map((c: any, i: number) => (
                  <li key={String(c?.key ?? i)}>
                    {asStr(c?.id1, '—')} ↔ {asStr(c?.id2, '—')}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-white/60">—</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
