import type { ActionId, AttributeId } from './types';
import { ACTION_GROUPS } from './types';



export type TraumaId =
  | 'haunted'
  | 'obsessed'
  | 'paranoid'
  | 'unstable'
  | 'reckless'
  | 'vicious'
  | 'cold'
  | 'soft';

export const TRAUMA_RU: Record<TraumaId, { name: string; desc: string }> = {
  haunted: {
    name: 'Визионер',
    desc: 'В самый неподходящий момент ты погружаешься в видения, воспоминания и галлюцинации.',
  },
  obsessed: {
    name: 'Маньяк',
    desc: 'Тебя охватывает одержимость чем‑то одним: занятием, человеком или идеологией.',
  },
  paranoid: {
    name: 'Параноик',
    desc: 'Ты везде видишь опасность и никому не доверяешь.',
  },
  unstable: {
    name: 'Псих',
    desc: 'Твоё состояние неустойчиво: вспышки ярости или отчаяния, импульсивность или ступор.',
  },
  reckless: {
    name: 'Раздолбай',
    desc: 'Тебе плевать даже на собственную безопасность и интересы.',
  },
  vicious: {
    name: 'Садист',
    desc: 'Ты ищешь возможность причинять людям вред — даже без повода или выгоды.',
  },
  cold: {
    name: 'Социопат',
    desc: 'Тебя не трогают эмоции и социальные связи; ты держишь дистанцию.',
  },
  soft: {
    name: 'Тряпка',
    desc: 'Тебе не хватает жёсткости: ты становишься сентиментальным, пассивным и мягким.',
  },
};

export function traumaLabel(id: string): string {
  const t = TRAUMA_RU[id as TraumaId];
  return t ? t.name : id;
}

export function traumaTitle(id: string): string | undefined {
  const t = TRAUMA_RU[id as TraumaId];
  return t ? `${t.name}: ${t.desc}` : undefined;
}


export const TRAUMA_OPTIONS: Array<{
  value: TraumaId;
  short: string;  // только название
  label: string;  // название + описание (для dropdown)
  desc: string;
}> = (Object.keys(TRAUMA_RU) as TraumaId[]).map((value) => {
  const { name, desc } = TRAUMA_RU[value];
  return {
    value,
    short: name,
    desc,
    label: `${name} — ${desc}`,
  };
});

export const ATTR_RU: Record<AttributeId, string> = {
  insight: 'Интуиция',
  prowess: 'Проворство',
  resolve: 'Решимость',
};

export const ACTION_RU: Record<ActionId, string> = {
  hunt: 'Охота',
  study: 'Изучение',
  survey: 'Наблюдение',
  tinker: 'Мастерение',
  finesse: 'Ловкость',
  prowl: 'Скрытность',
  skirmish: 'Схватка',
  wreck: 'Разрушение',
  attune: 'Настройка',
  command: 'Приказ',
  consort: 'Общение',
  sway: 'Убеждение',
};

export const POSITION_RU: Record<string, string> = {
  controlled: 'Под контролем',
  risky: 'Рискованно',
  desperate: 'Отчаянно',
};

export const EFFECT_RU: Record<string, string> = {
  limited: 'Ограниченный',
  standard: 'Обычный',
  great: 'Отличный',
};

export function groupOfAction(actionId: string) {
  return ACTION_GROUPS.find((g) => (g.actions as readonly string[]).includes(actionId));
}